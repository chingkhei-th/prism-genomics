"""
Pinata IPFS pinning service client for PRISM Genomics.

Handles authentication and communication with the Pinata API
for pinning and unpinning files on IPFS.
"""

import os
import logging
from dataclasses import dataclass

import requests

logger = logging.getLogger(__name__)

PINATA_API_BASE = "https://api.pinata.cloud"


@dataclass
class PinataConfig:
    """Pinata API credentials."""
    api_key: str
    secret_key: str
    gateway: str = "https://gateway.pinata.cloud/ipfs/"

    @classmethod
    def from_env(cls) -> "PinataConfig":
        """Load Pinata credentials from environment variables."""
        api_key = os.environ.get("PINATA_API_KEY", "")
        secret_key = os.environ.get("PINATA_SECRET", "")

        if not api_key or not secret_key:
            raise ValueError(
                "PINATA_API_KEY and PINATA_SECRET must be set. "
                "Get them from https://app.pinata.cloud/developers/api-keys"
            )

        return cls(
            api_key=api_key,
            secret_key=secret_key,
            gateway=os.environ.get("IPFS_GATEWAY", "https://gateway.pinata.cloud/ipfs/"),
        )


def _headers(config: PinataConfig) -> dict:
    """Build authentication headers for Pinata API."""
    return {
        "pinata_api_key": config.api_key,
        "pinata_secret_api_key": config.secret_key,
    }


def test_authentication(config: PinataConfig) -> bool:
    """
    Test if the Pinata API credentials are valid.

    Returns:
        True if authenticated, False otherwise.
    """
    try:
        res = requests.get(
            f"{PINATA_API_BASE}/data/testAuthentication",
            headers=_headers(config),
            timeout=10,
        )
        return res.status_code == 200
    except requests.RequestException as e:
        logger.error(f"Pinata auth test failed: {e}")
        return False


def pin_bytes(
    data: bytes,
    filename: str,
    config: PinataConfig,
    metadata: dict | None = None,
) -> str:
    """
    Pin raw bytes to IPFS via Pinata.

    Args:
        data: Raw bytes to pin.
        filename: Name for the file on IPFS.
        config: Pinata API credentials.
        metadata: Optional metadata dict (stored by Pinata, not on IPFS).

    Returns:
        IPFS CID (Content Identifier) string.
    """
    files = {"file": (filename, data, "application/octet-stream")}

    pinata_metadata = {"name": filename}
    if metadata:
        pinata_metadata["keyvalues"] = metadata

    payload = {"pinataMetadata": str(pinata_metadata).replace("'", '"')}

    res = requests.post(
        f"{PINATA_API_BASE}/pinning/pinFileToIPFS",
        files=files,
        data=payload,
        headers=_headers(config),
        timeout=120,
    )

    if res.status_code != 200:
        raise RuntimeError(f"Pinata upload failed ({res.status_code}): {res.text}")

    cid = res.json()["IpfsHash"]
    logger.info(f"Pinned {filename} → CID: {cid}")
    return cid


def pin_file(
    file_path: str,
    config: PinataConfig,
    metadata: dict | None = None,
) -> str:
    """
    Pin a local file to IPFS via Pinata.

    Args:
        file_path: Path to the file to upload.
        config: Pinata API credentials.
        metadata: Optional metadata dict.

    Returns:
        IPFS CID string.
    """
    filename = os.path.basename(file_path)

    with open(file_path, "rb") as f:
        data = f.read()

    return pin_bytes(data, filename, config, metadata)


def unpin(cid: str, config: PinataConfig) -> bool:
    """
    Unpin a file from Pinata (removes from their pinning service).

    Args:
        cid: IPFS CID to unpin.
        config: Pinata API credentials.

    Returns:
        True if successfully unpinned.
    """
    res = requests.delete(
        f"{PINATA_API_BASE}/pinning/unpin/{cid}",
        headers=_headers(config),
        timeout=30,
    )

    if res.status_code == 200:
        logger.info(f"Unpinned CID: {cid}")
        return True
    else:
        logger.error(f"Unpin failed ({res.status_code}): {res.text}")
        return False


def get_pin_list(config: PinataConfig, status: str = "pinned") -> list[dict]:
    """
    List all pinned files on your Pinata account.

    Args:
        config: Pinata API credentials.
        status: Filter by pin status ('pinned', 'unpinned', 'all').

    Returns:
        List of pin info dicts.
    """
    res = requests.get(
        f"{PINATA_API_BASE}/data/pinList",
        headers=_headers(config),
        params={"status": status, "pageLimit": 100},
        timeout=30,
    )

    if res.status_code != 200:
        raise RuntimeError(f"Failed to get pin list: {res.text}")

    return res.json().get("rows", [])
