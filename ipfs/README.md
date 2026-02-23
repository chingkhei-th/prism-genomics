# 📦 PRISM Genomics — IPFS Module

> Decentralized storage for encrypted genomic data via Pinata IPFS pinning service.

---

## Directory Structure

```
ipfs/
├── __init__.py              # Package exports
├── pinning_service.py       # Low-level Pinata API client
├── upload.py                # Upload pipeline (encrypt → hash → pin)
├── retrieve.py              # Retrieve pipeline (download → verify → decrypt)
└── .env                     # Pinata API credentials
```

---

## How It Works

### Upload Flow (Patient)

```
Raw VCF ──→ AES-256 Encrypt ──→ BLAKE3 Hash ──→ Pin to IPFS ──→ CID
                                      │                           │
                                      ▼                           ▼
                               Store on-chain              Store on-chain
                           (DataAccess.uploadData)     (DataAccess.uploadData)
```

### Retrieve Flow (Doctor)

```
On-chain CID ──→ Download from IPFS ──→ Verify BLAKE3 Hash ──→ Decrypt ──→ Raw VCF
                                              │
                                     Compare with on-chain hash
                                     (tamper detection)
```

---

## Files

### `pinning_service.py` — Pinata API Client

Low-level Pinata IPFS API interactions.

| Function | Purpose |
|---|---|
| `PinataConfig.from_env()` | Load API keys from environment variables |
| `test_authentication(config)` | Verify API keys are valid |
| `pin_bytes(data, filename, config)` | Pin raw bytes → returns CID |
| `pin_file(file_path, config)` | Pin a local file → returns CID |
| `unpin(cid, config)` | Unpin a file (remove from Pinata) |
| `get_pin_list(config)` | List all pinned files on your account |

---

### `upload.py` — Upload Pipeline

High-level upload functions that combine encryption, hashing, and pinning.

| Function | Purpose |
|---|---|
| `upload_encrypted_file(path, config)` | Upload pre-encrypted file → returns `{cid, blake3_hash}` |
| `upload_encrypted_bytes(data, name, config)` | Upload pre-encrypted bytes → returns `{cid, blake3_hash}` |
| `full_pipeline(raw_path, config)` | **Full flow:** raw VCF → encrypt → hash → pin → returns `{cid, blake3_hash, key_hex}` |

**`full_pipeline()` return value:**

```json
{
  "cid": "QmXyz...",
  "blake3_hash": "d74981ef...",
  "encryption_key_hex": "a1b2c3...",
  "original_filename": "patient_genome.vcf",
  "ipfs_url": "https://gateway.pinata.cloud/ipfs/QmXyz...",
  "status": "success",
  "next_step": "Call DataAccess.uploadData(cid, blake3_hash) on-chain"
}
```

---

### `retrieve.py` — Retrieve Pipeline

Download, verify, and decrypt genomic data from IPFS.

| Function | Purpose |
|---|---|
| `download_from_ipfs(cid, config)` | Download raw bytes by CID |
| `download_and_verify(cid, hash, config)` | Download + verify BLAKE3 hash against on-chain value |
| `download_and_decrypt(cid, hash, key, output, config)` | **Full flow:** download → verify → decrypt → save |
| `save_to_file(data, path)` | Save bytes to local file |

**`download_and_decrypt()` return value:**

```json
{
  "verified": true,
  "decrypted": true,
  "cid": "QmXyz...",
  "decrypted_size": 1048576,
  "output_path": "/path/to/restored.vcf",
  "status": "SUCCESS — data verified and decrypted"
}
```

**Tamper detection:**

```json
{
  "verified": false,
  "decrypted": false,
  "error": "File integrity check failed — refusing to decrypt"
}
```

---

## Setup

### 1. Get Pinata API Keys

1. Go to [app.pinata.cloud](https://app.pinata.cloud)
2. Sign up (free tier: 1GB storage)
3. Go to **API Keys** → Create new key
4. Copy API Key + Secret

### 2. Configure `.env`

```env
PINATA_API_KEY=your_api_key_here
PINATA_SECRET=your_secret_key_here
IPFS_GATEWAY=https://gateway.pinata.cloud/ipfs/
```

### 3. Test Connection

```bash
cd backend
uv run python -c "
import sys, os; sys.path.insert(0, '..')
# Load env
for line in open('../ipfs/.env'):
    if '=' in line and not line.startswith('#'):
        k, v = line.strip().split('=', 1)
        os.environ[k] = v
from ipfs.pinning_service import PinataConfig, test_authentication
config = PinataConfig.from_env()
print('Auth:', '✅ OK' if test_authentication(config) else '❌ FAILED')
"
```

---

## End-to-End Usage

```python
from ipfs.upload import full_pipeline
from ipfs.retrieve import download_and_decrypt
from ipfs.pinning_service import PinataConfig

config = PinataConfig.from_env()

# PATIENT: Upload
result = full_pipeline("patient_genome.vcf", config)
# result.cid → store on-chain
# result.blake3_hash → store on-chain
# result.encryption_key_hex → store securely

# DOCTOR: Retrieve (after on-chain access approved)
decrypted = download_and_decrypt(
    cid=result["cid"],
    expected_hash=result["blake3_hash"],
    encryption_key_hex=result["encryption_key_hex"],
    output_path="restored_genome.vcf",
    config=config,
)
# decrypted.status → "SUCCESS — data verified and decrypted"
```

---

## Dependencies

```
requests>=2.31    # HTTP client for Pinata API
cryptography>=46  # AES-256-GCM (used in retrieve.py for decryption)
blake3>=1.0       # BLAKE3 hashing
```
