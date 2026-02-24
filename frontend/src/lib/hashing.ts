import { blake3 } from "hash-wasm";

/**
 * Compute a real BLAKE3 hash of data.
 * Uses hash-wasm (pure WebAssembly) — works in all modern browsers.
 */
export async function computeBlake3Hash(data: Uint8Array): Promise<string> {
  return blake3(data);
}
