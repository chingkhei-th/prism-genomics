export async function encryptFile(fileBuffer: ArrayBuffer) {
  // Generate AES-256 key
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  // Generate 12-byte nonce
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    fileBuffer
  );

  // Final payload: nonce + ciphertext (same format as Python aes256.py)
  const payload = new Uint8Array([...iv, ...new Uint8Array(encrypted)]);

  // Export key for sharing
  const rawKey = await crypto.subtle.exportKey("raw", key);

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
  const keyBytes = new Uint8Array(
    keyHex.match(/.{2}/g)!.map((h) => parseInt(h, 16))
  );

  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  const iv = encryptedPayload.slice(0, 12);
  const ciphertext = encryptedPayload.slice(12);

  return crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
}
