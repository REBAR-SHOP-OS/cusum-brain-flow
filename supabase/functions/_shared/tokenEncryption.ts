/**
 * AES-256-GCM encryption/decryption for OAuth tokens at rest.
 * Uses TOKEN_ENCRYPTION_KEY env var (hex-encoded 32-byte key).
 */

const ALGORITHM = "AES-GCM";

async function getKey(): Promise<CryptoKey> {
  const hex = Deno.env.get("TOKEN_ENCRYPTION_KEY");
  if (!hex || hex.length < 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY not configured or too short");
  }
  // Derive a 256-bit key from the secret using SHA-256
  const encoder = new TextEncoder();
  const rawKey = await crypto.subtle.digest("SHA-256", encoder.encode(hex));
  return crypto.subtle.importKey("raw", rawKey, { name: ALGORITHM }, false, [
    "encrypt",
    "decrypt",
  ]);
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Encrypt a plaintext token. Returns "iv_hex:ciphertext_hex".
 */
export async function encryptToken(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoded
  );

  return `${toHex(iv.buffer)}:${toHex(ciphertext)}`;
}

/**
 * Decrypt an encrypted token string ("iv_hex:ciphertext_hex").
 */
export async function decryptToken(encrypted: string): Promise<string> {
  const key = await getKey();
  const [ivHex, ciphertextHex] = encrypted.split(":");

  if (!ivHex || !ciphertextHex) {
    throw new Error("Invalid encrypted token format");
  }

  const iv = fromHex(ivHex);
  const ciphertext = fromHex(ciphertextHex);

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}
