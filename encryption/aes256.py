import os
import secrets
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import hashes
import blake3

class GenomicEncryption:
    """
    Handles the AES-256-GCM symmetric encryption for genomic files (e.g., .vcf files)
    and BLAKE3 hashing for tamper-proof data integrity.
    """

    @staticmethod
    def generate_key() -> bytes:
        """Generates a secure 256-bit (32 byte) symmetric key."""
        return AESGCM.generate_key(bit_length=256)

    @staticmethod
    def encrypt_file(input_file_path: str, output_file_path: str, key: bytes) -> str:
        """
        Encrypts a file using AES-GCM and generates a BLAKE3 hash of the encrypted payload.
        Returns the hex representation of the BLAKE3 hash.
        """
        aesgcm = AESGCM(key)
        # 12-byte nonce (standard for GCM)
        nonce = secrets.token_bytes(12)

        print(f"Encrypting {input_file_path}...")
        with open(input_file_path, "rb") as f:
            raw_data = f.read()

        # Encrypt the data. 
        # AESGCM.encrypt outputs the ciphertext with the 16-byte authentication tag appended.
        encrypted_data = aesgcm.encrypt(nonce, raw_data, None)

        # The final stored payload is Nonce + Ciphertext (which includes the MAC tag)
        final_payload = nonce + encrypted_data

        with open(output_file_path, "wb") as f:
            f.write(final_payload)

        # Hash the encrypted file with BLAKE3
        hasher = blake3.blake3()
        hasher.update(final_payload)
        blake3_hash = hasher.hexdigest()

        print(f"Encryption successful. Encrypted file saved to {output_file_path}")
        print(f"BLAKE3 Hash: {blake3_hash}")
        
        return blake3_hash

    @staticmethod
    def decrypt_file(input_file_path: str, output_file_path: str, key: bytes):
        """
        Decrypts an AES-GCM encrypted file and writes the raw data to the output path.
        """
        aesgcm = AESGCM(key)

        print(f"Decrypting {input_file_path}...")
        with open(input_file_path, "rb") as f:
            encrypted_payload = f.read()

        # Extract the 12-byte nonce and the rest is the ciphertext + MAC tag
        nonce = encrypted_payload[:12]
        ciphertext = encrypted_payload[12:]

        try:
            raw_data = aesgcm.decrypt(nonce, ciphertext, None)
            with open(output_file_path, "wb") as f:
                f.write(raw_data)
            print(f"Decryption successful. Restored file saved to {output_file_path}")
        except Exception as e:
            print("Authentication failed during decryption! The file may be tampered with or the key is incorrect.")
            raise e

if __name__ == "__main__":
    # Quick demo usage
    test_key = GenomicEncryption.generate_key()
    print(f"Generated AES-256 Key (Hex): {test_key.hex()}")
    
    # Create a dummy file for testing
    dummy_input = "dummy_genome.vcf"
    with open(dummy_input, "w") as f:
        f.write("CHR\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\n1\t1000\trs123\tA\tC\t100\tPASS\t.")
        
    encrypted_file = "dummy_genome.vcf.enc"
    decrypted_file = "dummy_genome_restored.vcf"

    print("\n--- Encryption Step ---")
    data_hash = GenomicEncryption.encrypt_file(dummy_input, encrypted_file, test_key)
    
    print("\n--- Decryption Step ---")
    GenomicEncryption.decrypt_file(encrypted_file, decrypted_file, test_key)

    # Clean up dummy files
    os.remove(dummy_input)
    os.remove(encrypted_file)
    os.remove(decrypted_file)
