"""
Retrieve encrypted genomic data from IPFS and verify integrity.

Downloads data by CID from an IPFS gateway, verifies the BLAKE3 hash
against the on-chain record, and optionally decrypts with the provided key.
"""

import logging
from pathlib import Path

import requests

from ipfs.pinning_service import PinataConfig

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from encryption.blake3_hash import hash_bytes
from encryption.verify_integrity import verify_bytes_integrity

logger = logging.getLogger(__name__)


def download_from_ipfs(
    cid: str,
    config: PinataConfig | None = None,
    gateway: str | None = None,
    timeout: int = 120,
) -> bytes:
    """
    Download a file from IPFS by its CID.

    Args:
        cid: IPFS Content Identifier.
        config: Pinata config (used for gateway URL). If None, uses public gateway.
        gateway: Override gateway URL. If None, uses config or default.
        timeout: Request timeout in seconds.

    Returns:
        Raw bytes of the downloaded file.
    """
    if gateway is None:
        if config is not None:
            gateway = config.gateway
        else:
            gateway = "https://gateway.pinata.cloud/ipfs/"

    url = f"{gateway}{cid}"
    logger.info(f"Downloading from IPFS: {url}")

    res = requests.get(url, timeout=timeout)
    if res.status_code != 200:
        raise RuntimeError(
            f"IPFS download failed ({res.status_code}): {res.text[:200]}"
        )

    logger.info(f"Downloaded {len(res.content):,} bytes from CID: {cid}")
    return res.content


def download_and_verify(
    cid: str,
    expected_hash: str,
    config: PinataConfig | None = None,
) -> dict:
    """
    Download from IPFS and verify integrity against on-chain BLAKE3 hash.

    Args:
        cid: IPFS CID (from DataAccess.getGenomicData()).
        expected_hash: BLAKE3 hash (from DataAccess.getGenomicData()).
        config: Pinata config.

    Returns:
        Dict with 'data' (bytes if verified), 'verified', and status info.
    """
    data = download_from_ipfs(cid, config)

    verification = verify_bytes_integrity(data, expected_hash)

    result = {
        **verification,
        "cid": cid,
        "downloaded_size": len(data),
    }

    if verification["verified"]:
        result["data"] = data
        logger.info(f"Integrity verified for CID: {cid}")
    else:
        result["data"] = None
        logger.warning(
            f"INTEGRITY FAILURE for CID: {cid}! "
            f"Expected {expected_hash[:16]}..., got {verification['actual_hash'][:16]}..."
        )

    return result


def download_and_decrypt(
    cid: str,
    expected_hash: str,
    encryption_key_hex: str,
    output_path: str | None = None,
    config: PinataConfig | None = None,
) -> dict:
    """
    Full retrieval pipeline: download → verify → decrypt.

    Args:
        cid: IPFS CID.
        expected_hash: On-chain BLAKE3 hash.
        encryption_key_hex: Hex-encoded AES-256 key.
        output_path: Where to save decrypted file. If None, returns bytes.
        config: Pinata config.

    Returns:
        Dict with decrypted data/path and verification status.
    """
    from encryption.aes256 import GenomicEncryption

    # Step 1: Download and verify
    result = download_and_verify(cid, expected_hash, config)

    if not result["verified"]:
        return {
            **result,
            "decrypted": False,
            "error": "File integrity check failed — refusing to decrypt",
        }

    encrypted_data = result["data"]
    key = bytes.fromhex(encryption_key_hex)

    # Step 2: Decrypt in memory
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    aesgcm = AESGCM(key)
    nonce = encrypted_data[:12]
    ciphertext = encrypted_data[12:]

    try:
        decrypted_data = aesgcm.decrypt(nonce, ciphertext, None)
    except Exception as e:
        return {
            **result,
            "decrypted": False,
            "error": f"Decryption failed: {e}",
        }

    # Step 3: Save or return
    if output_path:
        Path(output_path).write_bytes(decrypted_data)
        logger.info(f"Decrypted file saved to: {output_path}")

    return {
        "verified": True,
        "decrypted": True,
        "cid": cid,
        "decrypted_size": len(decrypted_data),
        "decrypted_data": decrypted_data if output_path is None else None,
        "output_path": output_path,
        "status": "SUCCESS — data verified and decrypted",
    }


def save_to_file(data: bytes, output_path: str) -> str:
    """
    Save downloaded bytes to a local file.

    Args:
        data: Raw bytes to save.
        output_path: Destination file path.

    Returns:
        Absolute path of the saved file.
    """
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    logger.info(f"Saved {len(data):,} bytes to {path}")
    return str(path.resolve())
