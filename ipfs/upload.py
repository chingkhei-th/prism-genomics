"""
Upload encrypted genomic data to IPFS via Pinata.

Orchestrates the full upload pipeline:
  Encrypted file → BLAKE3 hash → Pin to IPFS → Return CID + hash

The CID and hash are then stored on-chain via DataAccess.uploadData().
"""

import logging
from pathlib import Path

from ipfs.pinning_service import PinataConfig, pin_bytes, pin_file

# Use parent package for encryption
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from encryption.blake3_hash import hash_bytes, hash_file

logger = logging.getLogger(__name__)


def upload_encrypted_file(
    file_path: str,
    config: PinataConfig | None = None,
) -> dict:
    """
    Upload an already-encrypted file to IPFS and compute its BLAKE3 hash.

    Args:
        file_path: Path to the encrypted .enc file.
        config: Pinata config. If None, loads from env vars.

    Returns:
        Dict with 'cid', 'blake3_hash', 'file_size', and 'filename'.
    """
    if config is None:
        config = PinataConfig.from_env()

    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    # Compute BLAKE3 hash of the encrypted file
    blake3_hash = hash_file(file_path)
    logger.info(f"BLAKE3 hash: {blake3_hash}")

    # Upload to IPFS
    cid = pin_file(
        file_path,
        config,
        metadata={
            "type": "encrypted_genomic_data",
            "blake3_hash": blake3_hash,
        },
    )

    result = {
        "cid": cid,
        "blake3_hash": blake3_hash,
        "file_size": path.stat().st_size,
        "filename": path.name,
        "ipfs_url": f"{config.gateway}{cid}",
    }

    logger.info(f"Upload complete: CID={cid}, hash={blake3_hash[:16]}...")
    return result


def upload_encrypted_bytes(
    data: bytes,
    filename: str,
    config: PinataConfig | None = None,
) -> dict:
    """
    Upload encrypted bytes directly to IPFS.

    Args:
        data: Encrypted bytes (nonce + ciphertext).
        filename: Name for the file on IPFS (e.g., 'patient_0xABC.vcf.enc').
        config: Pinata config. If None, loads from env vars.

    Returns:
        Dict with 'cid', 'blake3_hash', 'data_size', and 'filename'.
    """
    if config is None:
        config = PinataConfig.from_env()

    # Compute BLAKE3 hash
    blake3_hash = hash_bytes(data)
    logger.info(f"BLAKE3 hash: {blake3_hash}")

    # Upload to IPFS
    cid = pin_bytes(
        data,
        filename,
        config,
        metadata={
            "type": "encrypted_genomic_data",
            "blake3_hash": blake3_hash,
        },
    )

    result = {
        "cid": cid,
        "blake3_hash": blake3_hash,
        "data_size": len(data),
        "filename": filename,
        "ipfs_url": f"{config.gateway}{cid}",
    }

    logger.info(f"Upload complete: CID={cid}, hash={blake3_hash[:16]}...")
    return result


def full_pipeline(
    raw_file_path: str,
    config: PinataConfig | None = None,
) -> dict:
    """
    Full upload pipeline: encrypt → hash → upload to IPFS.

    This is the main entry point for the patient upload flow:
      1. Read raw VCF file
      2. Encrypt with AES-256-GCM
      3. Compute BLAKE3 hash of encrypted data
      4. Pin encrypted file to IPFS
      5. Return CID + hash (to be stored on-chain)

    Args:
        raw_file_path: Path to the raw .vcf file.
        config: Pinata config. If None, loads from env vars.

    Returns:
        Dict with 'cid', 'blake3_hash', 'encryption_key_hex', and metadata.
    """
    from encryption.aes256 import GenomicEncryption

    if config is None:
        config = PinataConfig.from_env()

    path = Path(raw_file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {raw_file_path}")

    # Step 1: Generate key and encrypt
    key = GenomicEncryption.generate_key()
    enc_path = str(path) + ".enc"
    blake3_hash = GenomicEncryption.encrypt_file(str(path), enc_path, key)

    # Step 2: Upload encrypted file to IPFS
    cid = pin_file(
        enc_path,
        config,
        metadata={
            "type": "encrypted_genomic_data",
            "blake3_hash": blake3_hash,
            "original_filename": path.name,
        },
    )

    # Step 3: Clean up local encrypted file
    Path(enc_path).unlink(missing_ok=True)

    result = {
        "cid": cid,
        "blake3_hash": blake3_hash,
        "encryption_key_hex": key.hex(),
        "original_filename": path.name,
        "ipfs_url": f"{config.gateway}{cid}",
        "status": "success",
        "next_step": "Call DataAccess.uploadData(cid, blake3_hash) on-chain",
    }

    logger.info(
        f"Full pipeline complete: {path.name} → CID={cid}, "
        f"hash={blake3_hash[:16]}..."
    )
    return result
