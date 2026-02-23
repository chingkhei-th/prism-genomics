"""
BLAKE3 hashing for genomic data integrity verification.

Provides standalone BLAKE3 hashing for files and byte data,
used to create tamper-proof hashes stored on-chain alongside IPFS CIDs.
"""

import blake3


def hash_file(file_path: str) -> str:
    """
    Compute the BLAKE3 hash of a file (streaming, memory-efficient).

    Args:
        file_path: Path to the file to hash.

    Returns:
        Hex-encoded BLAKE3 hash string.
    """
    hasher = blake3.blake3()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):  # 64KB chunks
            hasher.update(chunk)
    return hasher.hexdigest()


def hash_bytes(data: bytes) -> str:
    """
    Compute the BLAKE3 hash of raw bytes.

    Args:
        data: Raw bytes to hash.

    Returns:
        Hex-encoded BLAKE3 hash string.
    """
    hasher = blake3.blake3()
    hasher.update(data)
    return hasher.hexdigest()


def verify_hash(file_path: str, expected_hash: str) -> bool:
    """
    Verify a file's BLAKE3 hash against an expected value.

    Args:
        file_path: Path to the file to verify.
        expected_hash: Expected hex-encoded BLAKE3 hash.

    Returns:
        True if the hash matches, False if tampered.
    """
    actual_hash = hash_file(file_path)
    return actual_hash == expected_hash


if __name__ == "__main__":
    import tempfile
    import os

    # Demo
    with tempfile.NamedTemporaryFile(delete=False, suffix=".vcf") as f:
        f.write(b"#CHROM\tPOS\tID\tREF\tALT\n1\t1000\trs123\tA\tC\n")
        tmp_path = f.name

    file_hash = hash_file(tmp_path)
    print(f"BLAKE3 hash: {file_hash}")
    print(f"Verify (should be True):  {verify_hash(tmp_path, file_hash)}")
    print(f"Verify (should be False): {verify_hash(tmp_path, 'bad_hash')}")

    os.remove(tmp_path)
