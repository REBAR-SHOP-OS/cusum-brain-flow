import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Web Push crypto utilities for Deno (no npm dependency needed)
// Uses the Web Push protocol directly with the Web Crypto API

async function importVapidKeys(publicKeyB64: string, privateKeyB64: string) {
  const publicKeyBytes = base64UrlToUint8Array(publicKeyB64);
  const privateKeyBytes = base64UrlToUint8Array(privateKeyB64);
  
  const publicKey = await crypto.subtle.importKey(
    "raw", publicKeyBytes, { name: "ECDSA", namedCurve: "P-256" }, true, []
  );
  const privateKey = await crypto.subtle.importKey(
    "pkcs8", privateKeyBytes,
    { name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]
  );
  return { publicKey, privateKey, publicKeyBytes };
}

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  const padded = pad ? base64 + "=".repeat(4 - pad) : base64;
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function uint8ArrayToBase64Url(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function createJWT(audience: string, subject: string, vapidPrivateKey: CryptoKey, vapidPublicKeyBytes: Uint8Array): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + 86400, sub: subject };

  const enc = new TextEncoder();
  const headerB64 = uint8ArrayToBase64Url(enc.encode(JSON.stringify(header)));
  const payloadB64 = uint8ArrayToBase64Url(enc.encode(JSON.stringify(payload)));
  const unsigned = `${headerB64}.${payloadB64}`;

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" }, vapidPrivateKey, enc.encode(unsigned)
  );

  // Convert DER signature to raw r||s format
  const sigBytes = new Uint8Array(signature);
  let r: Uint8Array, s: Uint8Array;
  if (sigBytes[0] === 0x30) {
    // DER encoded
    const rLen = sigBytes[3];
    const rStart = 4;
    const rBytes = sigBytes.slice(rStart, rStart + rLen);
    const sLen = sigBytes[rStart + rLen + 1];
    const sStart = rStart + rLen + 2;
    const sBytes = sigBytes.slice(sStart, sStart + sLen);
    r = rBytes.length > 32 ? rBytes.slice(rBytes.length - 32) : rBytes;
    s = sBytes.length > 32 ? sBytes.slice(sBytes.length - 32) : sBytes;
    if (r.length < 32) { const p = new Uint8Array(32); p.set(r, 32 - r.length); r = p; }
    if (s.length < 32) { const p = new Uint8Array(32); p.set(s, 32 - s.length); s = p; }
  } else {
    r = sigBytes.slice(0, 32);
    s = sigBytes.slice(32, 64);
  }
  const rawSig = new Uint8Array(64);
  rawSig.set(r, 0);
  rawSig.set(s, 32);

  return `${unsigned}.${uint8ArrayToBase64Url(rawSig)}`;
}

async function encryptPayload(
  payload: string,
  p256dhB64: string,
  authB64: string
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; localPublicKey: Uint8Array }> {
  const enc = new TextEncoder();
  const userPublicKeyBytes = base64UrlToUint8Array(p256dhB64);
  const userAuth = base64UrlToUint8Array(authB64);

  const localKeyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const localPublicKeyRaw = new Uint8Array(await crypto.subtle.exportKey("raw", localKeyPair.publicKey));

  const userPublicKey = await crypto.subtle.importKey(
    "raw", userPublicKeyBytes, { name: "ECDH", namedCurve: "P-256" }, false, []
  );

  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "ECDH", public: userPublicKey }, localKeyPair.privateKey, 256
  ));

  // HKDF for auth info
  const authInfo = enc.encode("Content-Encoding: auth\0");
  const prkKey = await crypto.subtle.importKey("raw", sharedSecret, { name: "HKDF" }, false, ["deriveBits"]);
  const ikm = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: userAuth, info: authInfo }, prkKey, 256
  ));

  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Key info and nonce info
  const keyInfoBuf = new Uint8Array([
    ...enc.encode("Content-Encoding: aesgcm\0P-256\0"),
    0, 65, ...userPublicKeyBytes, 0, 65, ...localPublicKeyRaw
  ]);
  const nonceInfoBuf = new Uint8Array([
    ...enc.encode("Content-Encoding: nonce\0P-256\0"),
    0, 65, ...userPublicKeyBytes, 0, 65, ...localPublicKeyRaw
  ]);

  const ikmKey = await crypto.subtle.importKey("raw", ikm, { name: "HKDF" }, false, ["deriveBits"]);
  const contentKey = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: keyInfoBuf }, ikmKey, 128
  ));
  const nonce = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: nonceInfoBuf }, ikmKey, 96
  ));

  // Pad and encrypt
  const padded = new Uint8Array(2 + enc.encode(payload).length);
  padded.set([0, 0], 0);
  padded.set(enc.encode(payload), 2);

  const aesKey = await crypto.subtle.importKey("raw", contentKey, { name: "AES-GCM" }, false, ["encrypt"]);
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, padded));

  return { ciphertext: encrypted, salt, localPublicKey: localPublicKeyRaw };
}

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPublicKeyB64: string,
  vapidPrivateKeyB64: string,
  vapidSubject: string
): Promise<boolean> {
  try {
    const { publicKey: vapidPub, privateKey: vapidPriv, publicKeyBytes: vapidPubBytes } =
      await importVapidKeys(vapidPublicKeyB64, vapidPrivateKeyB64);

    const url = new URL(subscription.endpoint);
    const audience = `${url.protocol}//${url.host}`;

    const jwt = await createJWT(audience, vapidSubject, vapidPriv, vapidPubBytes);
    const { ciphertext, salt, localPublicKey } = await encryptPayload(payload, subscription.p256dh, subscription.auth);

    const resp = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aesgcm",
        "TTL": "86400",
        Authorization: `vapid t=${jwt}, k=${vapidPublicKeyB64}`,
        "Crypto-Key": `dh=${uint8ArrayToBase64Url(localPublicKey)};p256ecdsa=${vapidPublicKeyB64}`,
        Encryption: `salt=${uint8ArrayToBase64Url(salt)}`,
      },
      body: ciphertext,
    });

    if (resp.status === 410 || resp.status === 404) {
      console.log(`Subscription expired/invalid: ${subscription.endpoint.slice(0, 60)}...`);
      return false; // Subscription gone
    }
    if (!resp.ok) {
      console.error(`Push failed (${resp.status}):`, await resp.text());
    }
    return resp.ok;
  } catch (e) {
    console.error("sendWebPush error:", e);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { user_id, title, body, linkTo, tag } = await req.json();
    if (!user_id || !title) {
      return new Response(JSON.stringify({ error: "user_id and title required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(JSON.stringify({ error: "VAPID keys not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all push subscriptions for this user
    const { data: subs } = await svc
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", user_id);

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No subscriptions" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.stringify({ title, body, linkTo, tag: tag || "notification" });
    let sent = 0;
    const expired: string[] = [];

    for (const sub of subs) {
      const ok = await sendWebPush(sub, payload, vapidPublicKey, vapidPrivateKey, "mailto:ai@rebar.shop");
      if (ok) {
        sent++;
      } else {
        expired.push(sub.endpoint);
      }
    }

    // Clean up expired subscriptions
    if (expired.length > 0) {
      await svc.from("push_subscriptions").delete().in("endpoint", expired);
    }

    return new Response(JSON.stringify({ sent, expired: expired.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("send-push error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
