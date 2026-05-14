/**
 * HMAC-SHA256 signed tokens for unsubscribe links and similar one-shot URLs.
 * Token format: base64url(payloadJson) + "." + base64url(hmac)
 *
 * The signing secret is read from UNSUBSCRIBE_TOKEN_SECRET, falling back to
 * CRON_AUTH_TOKEN, then SUPABASE_SERVICE_ROLE_KEY so deployments don't need an extra secret.
 */

function getSecret(): string {
  const s = Deno.env.get("UNSUBSCRIBE_TOKEN_SECRET")
    ?? Deno.env.get("CRON_AUTH_TOKEN")
    ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    ?? "";
  if (!s) throw new Error("Token signing secret not configured");
  return s;
}

function b64url(bytes: Uint8Array): string {
  let s = btoa(String.fromCharCode(...bytes));
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(secret: string, data: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, data);
  return new Uint8Array(sig);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function signUnsubscribeToken(payload: Record<string, unknown>): Promise<string> {
  const secret = getSecret();
  const json = new TextEncoder().encode(JSON.stringify(payload));
  const sig = await hmac(secret, json);
  return `${b64url(json)}.${b64url(sig)}`;
}

export async function verifyUnsubscribeToken<T = Record<string, unknown>>(
  token: string,
): Promise<{ valid: boolean; payload?: T; legacy?: boolean }> {
  if (!token) return { valid: false };

  // Signed token: <payload>.<sig>
  if (token.includes(".")) {
    try {
      const [payloadPart, sigPart] = token.split(".", 2);
      const payloadBytes = b64urlDecode(payloadPart);
      const providedSig = b64urlDecode(sigPart);
      const expectedSig = await hmac(getSecret(), payloadBytes);
      if (!timingSafeEqual(providedSig, expectedSig)) return { valid: false };
      const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as T;
      return { valid: true, payload };
    } catch {
      return { valid: false };
    }
  }

  // Legacy unsigned token (in-flight emails sent before HMAC rollout).
  // Caller must additionally confirm (email, campaign_id) maps to a real send.
  try {
    const payload = JSON.parse(atob(token)) as T;
    return { valid: true, payload, legacy: true };
  } catch {
    return { valid: false };
  }
}
