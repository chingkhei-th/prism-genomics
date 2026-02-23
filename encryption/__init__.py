"""
PRISM Genomics — Encryption Module

Provides AES-256-GCM encryption, BLAKE3 hashing, key management,
and integrity verification for genomic data files.
"""

from encryption.aes256 import GenomicEncryption
from encryption.blake3_hash import hash_file, hash_bytes, verify_hash
from encryption.key_manager import generate_key, save_key, load_key, delete_key, list_patients
from encryption.verify_integrity import verify_file_integrity, verify_bytes_integrity, full_pipeline_verify

__all__ = [
    "GenomicEncryption",
    "hash_file",
    "hash_bytes",
    "verify_hash",
    "generate_key",
    "save_key",
    "load_key",
    "delete_key",
    "list_patients",
    "verify_file_integrity",
    "verify_bytes_integrity",
    "full_pipeline_verify",
]
