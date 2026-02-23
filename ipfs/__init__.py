"""
PRISM Genomics — IPFS Module

Handles uploading encrypted genomic data to IPFS (via Pinata),
retrieving and verifying data integrity, and managing pins.
"""

from ipfs.pinning_service import PinataConfig, pin_bytes, pin_file, unpin, test_authentication
from ipfs.upload import upload_encrypted_file, upload_encrypted_bytes, full_pipeline
from ipfs.retrieve import download_from_ipfs, download_and_verify, download_and_decrypt

__all__ = [
    "PinataConfig",
    "pin_bytes",
    "pin_file",
    "unpin",
    "test_authentication",
    "upload_encrypted_file",
    "upload_encrypted_bytes",
    "full_pipeline",
    "download_from_ipfs",
    "download_and_verify",
    "download_and_decrypt",
]
