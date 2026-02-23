# 🔐 PRISM Genomics — Encryption Module

> AES-256-GCM encryption + BLAKE3 integrity hashing + secure key management for genomic data.

---

## Directory Structure

```
encryption/
├── __init__.py              # Package exports
├── aes256.py                # AES-256-GCM file encryption/decryption
├── blake3_hash.py           # BLAKE3 hashing (streaming + verification)
├── key_manager.py           # Password-protected local keystore
└── verify_integrity.py      # Integrity verification against on-chain hashes
```

---

## How It Works

```
Raw VCF File
    │
    ▼
┌──────────────────────┐
│  AES-256-GCM Encrypt │ ← Random 256-bit key + 12-byte nonce
│  (aes256.py)         │
└──────────┬───────────┘
           │
    Encrypted Payload (nonce + ciphertext + auth tag)
           │
    ┌──────┴──────┐
    ▼             ▼
┌────────┐  ┌──────────┐
│ BLAKE3 │  │ Upload   │
│ Hash   │  │ to IPFS  │
└───┬────┘  └────┬─────┘
    │            │
    ▼            ▼
 On-chain     On-chain
 (hash)       (CID)
```

---

## Files

### `aes256.py` — AES-256-GCM Encryption

Symmetric encryption using the **AES-256-GCM** authenticated cipher.

| Function | Purpose |
|---|---|
| `GenomicEncryption.generate_key()` | Generate secure 256-bit key |
| `GenomicEncryption.encrypt_file(input, output, key)` | Encrypt file → returns BLAKE3 hash |
| `GenomicEncryption.decrypt_file(input, output, key)` | Decrypt file (validates auth tag) |

**Payload format:** `[12-byte nonce][ciphertext + 16-byte GCM auth tag]`

**Security properties:**
- **Confidentiality** — AES-256 with random nonce
- **Integrity** — GCM authentication tag detects tampering
- **Freshness** — Unique nonce per encryption

---

### `blake3_hash.py` — BLAKE3 Hashing

Cryptographic hashing for tamper detection. Hashes are stored on the blockchain.

| Function | Purpose |
|---|---|
| `hash_file(path)` | Streaming BLAKE3 hash (64KB chunks, memory-efficient) |
| `hash_bytes(data)` | Hash raw bytes |
| `verify_hash(path, expected)` | Compare file hash against expected value |

**Why BLAKE3 over SHA-256?**
- 6x faster than SHA-256
- Tree-based structure enables parallel hashing
- 256-bit security level

---

### `key_manager.py` — Encrypted Key Storage

Stores AES-256 keys in a **password-protected local keystore**, keyed by patient Ethereum address.

| Function | Purpose |
|---|---|
| `generate_key()` | Generate new AES-256 key |
| `save_key(key, address, password)` | Encrypt + store key in keystore |
| `load_key(address, password)` | Decrypt + retrieve key from keystore |
| `delete_key(address)` | Remove key from keystore |
| `list_patients()` | List all addresses with stored keys |

**Protection:** PBKDF2-HMAC-SHA256 (600,000 iterations) derives master key from password.

**Keystore format** (`.keystore.json`):

```json
{
  "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266": {
    "salt": "hex...",
    "nonce": "hex...",
    "encrypted_key": "hex..."
  }
}
```

---

### `verify_integrity.py` — On-Chain Integrity Verification

Verifies downloaded files against BLAKE3 hashes stored on the blockchain.

| Function | Purpose |
|---|---|
| `verify_file_integrity(path, expected_hash)` | Check local file vs on-chain hash |
| `verify_bytes_integrity(data, expected_hash)` | Check raw bytes vs on-chain hash |
| `full_pipeline_verify(path, hash, cid)` | Full report with decrypt recommendation |

**Output example:**

```json
{
  "verified": true,
  "actual_hash": "d74981ef...",
  "expected_hash": "d74981ef...",
  "status": "VALID — file is intact",
  "recommendation": "Safe to decrypt — file is authentic."
}
```

---

## Dependencies

```
cryptography>=46.0   # AES-256-GCM encryption
blake3>=1.0          # BLAKE3 hashing
```

---

## Quick Test

```bash
cd backend
uv run python -c "
import sys; sys.path.insert(0, '..')
from encryption.aes256 import GenomicEncryption
from encryption.blake3_hash import hash_bytes
from encryption.key_manager import generate_key

key = generate_key()
h = hash_bytes(b'test data')
print(f'Key: {key.hex()[:16]}...')
print(f'Hash: {h[:16]}...')
print('All working!')
"
```
