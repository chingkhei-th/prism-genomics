"""
Encryption key manager for PRISM Genomics.

Handles secure generation, storage, and retrieval of AES-256 keys.
Keys are stored locally in an encrypted JSON keystore, protected by a
master password using PBKDF2 key derivation.

In production, this would be replaced by a hardware security module (HSM)
or a key management service (KMS) like AWS KMS or HashiCorp Vault.
"""

import json
import os
import secrets
from pathlib import Path

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

DEFAULT_KEYSTORE_PATH = Path(__file__).parent / ".keystore.json"


def _derive_master_key(password: str, salt: bytes) -> bytes:
    """Derive a 256-bit master key from a password using PBKDF2."""
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=600_000,
    )
    return kdf.derive(password.encode())


def generate_key() -> bytes:
    """Generate a new AES-256 key (32 bytes)."""
    return AESGCM.generate_key(bit_length=256)


def save_key(
    key: bytes,
    patient_address: str,
    password: str,
    keystore_path: Path = DEFAULT_KEYSTORE_PATH,
) -> None:
    """
    Save an AES-256 key to the local keystore, encrypted with a master password.

    Args:
        key: The AES-256 key to store.
        patient_address: Ethereum address of the patient (used as key ID).
        password: Master password to encrypt the keystore entry.
        keystore_path: Path to the keystore file.
    """
    # Load existing keystore or create new
    keystore: dict = {}
    if keystore_path.exists():
        with open(keystore_path) as f:
            keystore = json.load(f)

    # Encrypt the key with master password
    salt = secrets.token_bytes(16)
    master_key = _derive_master_key(password, salt)
    aesgcm = AESGCM(master_key)
    nonce = secrets.token_bytes(12)
    encrypted_key = aesgcm.encrypt(nonce, key, None)

    keystore[patient_address.lower()] = {
        "salt": salt.hex(),
        "nonce": nonce.hex(),
        "encrypted_key": encrypted_key.hex(),
    }

    with open(keystore_path, "w") as f:
        json.dump(keystore, f, indent=2)

    print(f"Key saved for patient {patient_address}")


def load_key(
    patient_address: str,
    password: str,
    keystore_path: Path = DEFAULT_KEYSTORE_PATH,
) -> bytes:
    """
    Load and decrypt an AES-256 key from the local keystore.

    Args:
        patient_address: Ethereum address of the patient.
        password: Master password to decrypt the keystore entry.
        keystore_path: Path to the keystore file.

    Returns:
        The decrypted AES-256 key bytes.

    Raises:
        KeyError: If no key exists for the given address.
        Exception: If the password is wrong (authentication fails).
    """
    if not keystore_path.exists():
        raise FileNotFoundError(f"Keystore not found at {keystore_path}")

    with open(keystore_path) as f:
        keystore = json.load(f)

    addr = patient_address.lower()
    if addr not in keystore:
        raise KeyError(f"No key found for patient {patient_address}")

    entry = keystore[addr]
    salt = bytes.fromhex(entry["salt"])
    nonce = bytes.fromhex(entry["nonce"])
    encrypted_key = bytes.fromhex(entry["encrypted_key"])

    master_key = _derive_master_key(password, salt)
    aesgcm = AESGCM(master_key)

    try:
        return aesgcm.decrypt(nonce, encrypted_key, None)
    except Exception:
        raise ValueError("Wrong password or corrupted keystore entry")


def delete_key(
    patient_address: str,
    keystore_path: Path = DEFAULT_KEYSTORE_PATH,
) -> None:
    """Remove a key from the keystore."""
    if not keystore_path.exists():
        return

    with open(keystore_path) as f:
        keystore = json.load(f)

    addr = patient_address.lower()
    if addr in keystore:
        del keystore[addr]
        with open(keystore_path, "w") as f:
            json.dump(keystore, f, indent=2)
        print(f"Key deleted for patient {patient_address}")


def list_patients(
    keystore_path: Path = DEFAULT_KEYSTORE_PATH,
) -> list[str]:
    """List all patient addresses that have stored keys."""
    if not keystore_path.exists():
        return []

    with open(keystore_path) as f:
        keystore = json.load(f)

    return list(keystore.keys())


if __name__ == "__main__":
    import tempfile

    # Demo with temporary keystore
    tmp_keystore = Path(tempfile.mktemp(suffix=".json"))

    patient = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
    password = "my_secure_password"

    # Generate and save
    key = generate_key()
    print(f"Generated key: {key.hex()}")

    save_key(key, patient, password, keystore_path=tmp_keystore)

    # List patients
    patients = list_patients(keystore_path=tmp_keystore)
    print(f"Stored patients: {patients}")

    # Load and verify
    loaded_key = load_key(patient, password, keystore_path=tmp_keystore)
    print(f"Loaded key:    {loaded_key.hex()}")
    print(f"Keys match: {key == loaded_key}")

    # Wrong password test
    try:
        load_key(patient, "wrong_password", keystore_path=tmp_keystore)
    except ValueError as e:
        print(f"Wrong password caught: {e}")

    # Cleanup
    tmp_keystore.unlink()
