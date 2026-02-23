"""
End-to-end integrity verification for PRISM Genomics.

Verifies that encrypted genomic data downloaded from IPFS matches
the BLAKE3 hash stored on the blockchain — ensuring no tampering
occurred during storage or transmission.
"""

from pathlib import Path

from encryption.blake3_hash import hash_bytes, hash_file


def verify_file_integrity(file_path: str, expected_hash: str) -> dict:
    """
    Verify a local file against its expected BLAKE3 hash.

    Args:
        file_path: Path to the encrypted file to verify.
        expected_hash: BLAKE3 hash stored on-chain.

    Returns:
        Verification result dict with status and details.
    """
    if not Path(file_path).exists():
        return {
            "verified": False,
            "error": f"File not found: {file_path}",
        }

    actual_hash = hash_file(file_path)
    is_valid = actual_hash == expected_hash

    return {
        "verified": is_valid,
        "actual_hash": actual_hash,
        "expected_hash": expected_hash,
        "file_path": file_path,
        "file_size_bytes": Path(file_path).stat().st_size,
        "status": "VALID — file is intact" if is_valid else "TAMPERED — hash mismatch!",
    }


def verify_bytes_integrity(data: bytes, expected_hash: str) -> dict:
    """
    Verify raw bytes against their expected BLAKE3 hash.

    Args:
        data: Raw bytes (e.g., downloaded from IPFS).
        expected_hash: BLAKE3 hash stored on-chain.

    Returns:
        Verification result dict.
    """
    actual_hash = hash_bytes(data)
    is_valid = actual_hash == expected_hash

    return {
        "verified": is_valid,
        "actual_hash": actual_hash,
        "expected_hash": expected_hash,
        "data_size_bytes": len(data),
        "status": "VALID — data is intact" if is_valid else "TAMPERED — hash mismatch!",
    }


def full_pipeline_verify(
    encrypted_file_path: str,
    on_chain_hash: str,
    on_chain_cid: str,
) -> dict:
    """
    Full verification pipeline — checks file integrity, reports on-chain metadata.

    Args:
        encrypted_file_path: Path to the encrypted .enc file.
        on_chain_hash: BLAKE3 hash from the smart contract.
        on_chain_cid: IPFS CID from the smart contract.

    Returns:
        Comprehensive verification report.
    """
    integrity = verify_file_integrity(encrypted_file_path, on_chain_hash)

    return {
        **integrity,
        "on_chain_cid": on_chain_cid,
        "on_chain_hash": on_chain_hash,
        "pipeline": "IPFS CID → Download → BLAKE3 verify → Decrypt",
        "recommendation": (
            "Safe to decrypt — file is authentic."
            if integrity["verified"]
            else "DO NOT DECRYPT — file integrity compromised!"
        ),
    }


if __name__ == "__main__":
    import os
    import tempfile
    from encryption.aes256 import GenomicEncryption
    from encryption.blake3_hash import hash_file as blake3_hash_file

    # Demo: encrypt a file, then verify its integrity

    # 1. Create a dummy VCF
    with tempfile.NamedTemporaryFile(delete=False, suffix=".vcf", mode="w") as f:
        f.write("#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\n")
        f.write("1\t1000\trs123\tA\tC\t100\tPASS\t.\n")
        vcf_path = f.name

    enc_path = vcf_path + ".enc"

    # 2. Encrypt
    key = GenomicEncryption.generate_key()
    stored_hash = GenomicEncryption.encrypt_file(vcf_path, enc_path, key)
    fake_cid = "QmTestCid123456789"

    # 3. Verify — should pass
    print("\n--- Verification (untampered) ---")
    result = full_pipeline_verify(enc_path, stored_hash, fake_cid)
    for k, v in result.items():
        print(f"  {k}: {v}")

    # 4. Tamper with the file
    with open(enc_path, "r+b") as f:
        f.seek(20)
        f.write(b"\xff\xff\xff")

    # 5. Verify again — should fail
    print("\n--- Verification (tampered) ---")
    result = full_pipeline_verify(enc_path, stored_hash, fake_cid)
    for k, v in result.items():
        print(f"  {k}: {v}")

    # Cleanup
    os.remove(vcf_path)
    os.remove(enc_path)
