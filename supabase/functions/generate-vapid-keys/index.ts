import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function uint8ArrayToBase64Url(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const keyPair = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]
    );
    
    const publicKeyRaw = new Uint8Array(await crypto.subtle.exportKey("raw", keyPair.publicKey));
    const privateKeyPkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", keyPair.privateKey));
    
    return new Response(JSON.stringify({
      publicKey: uint8ArrayToBase64Url(publicKeyRaw),
      privateKey: uint8ArrayToBase64Url(privateKeyPkcs8),
      instructions: "Add these as VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY secrets"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
