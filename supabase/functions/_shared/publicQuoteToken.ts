const encoder = new TextEncoder();

export type PublicQuoteScope = "view" | "accept" | "copy";

export interface PublicQuoteTokenPayload {
  quoteId: string;
  scopes: PublicQuoteScope[];
  exp: number; // unix timestamp (seconds)
  nonce?: string;
}

function base64UrlEncode(input: string): string {
  return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(input: string): string {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  return atob(b64 + pad);
}

function getSecret(): string {
  const secret = Deno.env.get("QUOTE_PUBLIC_LINK_SECRET");
  if (!secret || secret.trim().length < 32) {
    throw new Error("QUOTE_PUBLIC_LINK_SECRET is missing or too short");
  }
  return secret;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function signBody(bodyB64: string): Promise<string> {
  const key = await importHmacKey(getSecret());
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(bodyB64));
  return base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
}

export async function createPublicQuoteToken(payload: PublicQuoteTokenPayload): Promise<string> {
  if (!payload.quoteId) throw new Error("quoteId is required");
  if (!Array.isArray(payload.scopes) || payload.scopes.length === 0) {
    throw new Error("scopes are required");
  }
  if (!Number.isFinite(payload.exp)) throw new Error("exp must be a unix timestamp");

  const bodyB64 = base64UrlEncode(JSON.stringify(payload));
  const sigB64 = await signBody(bodyB64);
  return `${bodyB64}.${sigB64}`;
}

export async function verifyPublicQuoteToken(
  token: string | undefined,
  expectedQuoteId: string,
  requiredScope: PublicQuoteScope,
): Promise<PublicQuoteTokenPayload> {
  if (!token) throw new Error("Missing public quote token");
  const [bodyB64, sigB64] = token.split(".");
  if (!bodyB64 || !sigB64) throw new Error("Invalid token format");

  const key = await importHmacKey(getSecret());
  const sigBytes = Uint8Array.from(base64UrlDecode(sigB64), (c) => c.charCodeAt(0));
  const isValidSig = await crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes,
    encoder.encode(bodyB64),
  );
  if (!isValidSig) throw new Error("Invalid token signature");

  let payload: PublicQuoteTokenPayload;
  try {
    payload = JSON.parse(base64UrlDecode(bodyB64));
  } catch {
    throw new Error("Invalid token payload");
  }

  if (payload.quoteId !== expectedQuoteId) throw new Error("Token quote mismatch");
  if (!payload.scopes?.includes(requiredScope)) throw new Error("Insufficient token scope");
  if (!payload.exp || Math.floor(Date.now() / 1000) > payload.exp) throw new Error("Token expired");

  return payload;
}
