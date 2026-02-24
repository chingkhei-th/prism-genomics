import os
from datetime import datetime, timedelta
from typing import Optional
import hashlib
import base64
import bcrypt
import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, EmailStr
from eth_account import Account
from src.db import db
from prisma.models import User


# --- Configuration ---
JWT_SECRET = os.getenv("JWT_SECRET", "super-secret-key-change-it")
AES_SECRET_KEY = os.getenv("AES_SECRET_KEY", "change-this-aes-secret-key-now!")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

# Derive a 32-byte AES-256 key from the secret
AES_KEY = hashlib.sha256(AES_SECRET_KEY.encode()).digest()

# --- Security Setup ---
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/signin")

router = APIRouter(prefix="/auth", tags=["auth"])

# --- AES-256-GCM Password Helpers (using GenomicEncryption) ---
def _aes256_encrypt_password(password: str) -> str:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    import secrets
    aesgcm = AESGCM(AES_KEY)
    nonce = secrets.token_bytes(12)
    ciphertext = aesgcm.encrypt(nonce, password.encode(), None)
    return base64.b64encode(nonce + ciphertext).decode()

def _aes256_decrypt_password(encrypted_b64: str) -> str:
    """Decrypt an AES-256-GCM encrypted password."""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    raw = base64.b64decode(encrypted_b64)
    nonce = raw[:12]
    ciphertext = raw[12:]
    aesgcm = AESGCM(AES_KEY)
    return aesgcm.decrypt(nonce, ciphertext, None).decode()

# --- Wallet Helpers ---
def generate_custodial_wallet() -> tuple[str, str]:
    """Generate a new Ethereum account and return (address, encrypted_private_key)."""
    acct = Account.create()
    encrypted_pk = _aes256_encrypt_password(acct.key.hex())
    return acct.address, encrypted_pk

# --- Helper Functions ---
def verify_password(plain_password: str, stored_value: str) -> bool:
    """Verify password against stored 'encrypted_pw::bcrypt_hash' value."""
    if "::" not in stored_value:
        # Fallback: plain bcrypt comparison
        return bcrypt.checkpw(plain_password.encode(), stored_value.encode())
    encrypted_pw_b64, bcrypt_hash = stored_value.split("::", 1)
    decrypted = _aes256_decrypt_password(encrypted_pw_b64)
    return bcrypt.checkpw(decrypted.encode(), bcrypt_hash.encode()) and decrypted == plain_password

def get_password_hash(password: str) -> str:
    """Encrypt password with AES-256-GCM, then bcrypt the plaintext.
    Stores as 'aes_encrypted_pw::bcrypt_hash'."""
    encrypted_pw = _aes256_encrypt_password(password)
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode(), salt)
    return f"{encrypted_pw}::{hashed.decode()}"

# --- Schemas ---
class UserSignup(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "patient"

class UserSignin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class UserProfile(BaseModel):
    id: str
    email: str
    name: str
    role: str
    walletAddress: Optional[str] = None

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except Exception:
        raise credentials_exception
    
    user = await db.user.find_unique(where={"email": email})
    if user is None:
        raise credentials_exception
    return user

class AuthResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserProfile

# --- Endpoints ---

@router.post("/signup", response_model=AuthResponse)
async def signup(user_data: UserSignup):
    # Check if user exists
    existing_user = await db.user.find_unique(where={"email": user_data.email})
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="User with this email already exists"
        )
    
    # Hash password
    hashed_password = get_password_hash(user_data.password)
    
    # Generate custodial wallet
    wallet_address, encrypted_pk = generate_custodial_wallet()
    
    # Create user
    try:
        user = await db.user.create(
            data={
                "name": user_data.name,
                "email": user_data.email,
                "password": hashed_password,
                "role": user_data.role,
                "walletAddress": wallet_address,
                "encryptedPrivateKey": encrypted_pk,
            }
        )
        
        # Generate token for immediate login after signup
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.email}, expires_delta=access_token_expires
        )
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": user
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/signin", response_model=AuthResponse)
async def signin(user_data: UserSignin):
    user = await db.user.find_unique(where={"email": user_data.email})
    if not user or not verify_password(user_data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@router.get("/me", response_model=UserProfile)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user
