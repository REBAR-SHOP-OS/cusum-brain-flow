import { handleRequest } from "../_shared/requestHandler.ts";

function uint8ArrayToBase64Url(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

Deno.serve((req) =>
  handleRequest(req, async () => {
    const keyPair = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]
    );

    const publicKeyRaw = new Uint8Array(await crypto.subtle.exportKey("raw", keyPair.publicKey));
    const privateKeyPkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", keyPair.privateKey));

    return {
      publicKey: uint8ArrayToBase64Url(publicKeyRaw),
      privateKey: uint8ArrayToBase64Url(privateKeyPkcs8),
      instructions: "Add these as VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY secrets",
    };
  }, { functionName: "generate-vapid-keys", requireCompany: false, wrapResult: false })
);
