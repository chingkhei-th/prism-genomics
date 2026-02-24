import { gcm } from "@noble/ciphers/aes.js";
import { randomBytes } from "@noble/ciphers/utils.js";

/**
 * AES-256-GCM encryption using @noble/ciphers.
 * Works in ALL contexts (HTTP, HTTPS, localhost) — no crypto.subtle needed.
 * Wire format: 12-byte nonce ‖ ciphertext+tag  (same as Python aes256.py)
 */

export async function encryptFile(fileBuffer: ArrayBuffer) {
  // Generate 256-bit (32-byte) AES key
  const keyBytes = randomBytes(32);

  // Generate 12-byte nonce / IV
  const iv = randomBytes(12);

  // Encrypt
  const aes = gcm(keyBytes, iv);
  const encrypted = aes.encrypt(new Uint8Array(fileBuffer));

  // Final payload: nonce + ciphertext (same format as Python aes256.py)
  const payload = new Uint8Array([...iv, ...encrypted]);

  return {
    encryptedPayload: payload,
    keyHex: Array.from(keyBytes)
      .map((b: number) => b.toString(16).padStart(2, "0"))
      .join(""),
  };
}

export async function decryptFile(
  encryptedPayload: Uint8Array,
  keyHex: string
): Promise<ArrayBuffer> {
  const keyBytes = new Uint8Array(
    keyHex.match(/.{2}/g)!.map((h) => parseInt(h, 16))
  );

  const iv = encryptedPayload.slice(0, 12);
  const ciphertext = encryptedPayload.slice(12);

  const aes = gcm(keyBytes, iv);
  const decrypted = aes.decrypt(ciphertext);

  return decrypted.buffer as ArrayBuffer;
}
