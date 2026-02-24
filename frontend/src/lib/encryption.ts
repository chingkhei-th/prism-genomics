/**
 * Get the SubtleCrypto API, throwing a clear error if unavailable.
 * crypto.subtle requires a Secure Context (HTTPS or localhost).
 */
function getSubtleCrypto(): SubtleCrypto {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    return crypto.subtle;
  }
  throw new Error(
    "Web Crypto API (crypto.subtle) is not available. " +
      "This API requires a secure context — please access the site over HTTPS or via localhost."
  );
}

export async function encryptFile(fileBuffer: ArrayBuffer) {
  const subtle = getSubtleCrypto();

  // Generate AES-256 key
  const key = await subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  // Generate 12-byte nonce
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt
  const encrypted = await subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    fileBuffer
  );

  // Final payload: nonce + ciphertext (same format as Python aes256.py)
  const payload = new Uint8Array([...iv, ...new Uint8Array(encrypted)]);

  // Export key for sharing
  const rawKey = await subtle.exportKey("raw", key);

  return {
    encryptedPayload: payload,
    keyHex: Array.from(new Uint8Array(rawKey))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(""),
  };
}

export async function decryptFile(
  encryptedPayload: Uint8Array,
  keyHex: string
): Promise<ArrayBuffer> {
  const subtle = getSubtleCrypto();

  const keyBytes = new Uint8Array(
    keyHex.match(/.{2}/g)!.map((h) => parseInt(h, 16))
  );

  const key = await subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  const iv = encryptedPayload.slice(0, 12);
  const ciphertext = encryptedPayload.slice(12);

  return subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
}
