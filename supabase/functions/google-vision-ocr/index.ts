import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { optionalAuth, corsHeaders } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check — allow internal calls (from other edge functions) and authenticated users
    const userId = await optionalAuth(req);
    // Internal calls from edge functions use service anon key; external calls must have auth
    const isInternalCall = req.headers.get("apikey") === Deno.env.get("SUPABASE_ANON_KEY");
    if (!userId && !isInternalCall) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const credentialsJson = Deno.env.get("GOOGLE_VISION_CREDENTIALS");
    if (!credentialsJson) {
      throw new Error("GOOGLE_VISION_CREDENTIALS not configured");
    }

    const credentials = JSON.parse(credentialsJson);
    
    // Get access token using service account
    const accessToken = await getAccessToken(credentials);
    
    const { imageUrl, imageBase64, features = ["TEXT_DETECTION"] }: VisionRequest = await req.json();

    if (!imageUrl && !imageBase64) {
      return new Response(
        JSON.stringify({ error: "Either imageUrl or imageBase64 is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build image source
    const imageSource = imageUrl 
      ? { source: { imageUri: imageUrl } }
      : { content: imageBase64 };

    // Build feature requests
    const featureRequests = features.map(type => ({ type, maxResults: 50 }));

    // Call Google Vision API
    const visionResponse = await fetch(
      "https://vision.googleapis.com/v1/images:annotate",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requests: [
            {
              image: imageSource,
              features: featureRequests,
            },
          ],
        }),
      }
    );

    if (!visionResponse.ok) {
      const errorText = await visionResponse.text();
      console.error("Vision API error:", errorText);
      throw new Error(`Vision API error: ${visionResponse.status}`);
    }

    const visionData = await visionResponse.json();
    const response = visionData.responses?.[0] || {};

    // Extract text annotations
    const textAnnotations = response.textAnnotations || [];
    const fullText = textAnnotations[0]?.description || "";
    
    // Extract individual text blocks with bounding boxes
    const textBlocks = textAnnotations.slice(1).map((annotation: any) => ({
      text: annotation.description,
      boundingPoly: annotation.boundingPoly,
    }));

    return new Response(
      JSON.stringify({
        fullText,
        textBlocks,
        rawResponse: response,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("OCR error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Get access token from service account credentials
async function getAccessToken(credentials: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600; // 1 hour

  // Create JWT header and payload
  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const payload = {
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/cloud-vision",
    aud: credentials.token_uri,
    iat: now,
    exp: expiry,
  };

  // Sign JWT
  const jwt = await signJwt(header, payload, credentials.private_key);

  // Exchange JWT for access token
  const tokenResponse = await fetch(credentials.token_uri, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error("Token exchange error:", errorText);
    throw new Error(`Failed to get access token: ${tokenResponse.status}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

// Sign JWT using RS256
async function signJwt(header: any, payload: any, privateKeyPem: string): Promise<string> {
  const encoder = new TextEncoder();
  
  // Base64URL encode header and payload
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signatureInput = `${headerB64}.${payloadB64}`;

  // Import private key
  const privateKey = await importPrivateKey(privateKeyPem);

  // Sign
  const signature = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    privateKey,
    encoder.encode(signatureInput)
  );

  const signatureB64 = base64UrlEncode(new Uint8Array(signature));
  return `${signatureInput}.${signatureB64}`;
}

// Import PEM private key
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  // Remove PEM headers and convert to binary
  const pemContents = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  return await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );
}

// Base64URL encode
function base64UrlEncode(input: string | Uint8Array): string {
  let base64: string;
  
  if (typeof input === "string") {
    base64 = btoa(input);
  } else {
    base64 = btoa(String.fromCharCode(...input));
  }
  
  return base64
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
