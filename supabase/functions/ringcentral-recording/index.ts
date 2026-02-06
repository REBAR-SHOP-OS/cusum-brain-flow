import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Use sandbox server — switch to https://platform.ringcentral.com when app is promoted to production
const RC_SERVER = "https://platform.devtest.ringcentral.com";

async function verifyAuth(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) return null;
  return data.claims.sub as string;
}

async function getRCAccessToken(): Promise<string> {
  const clientId = Deno.env.get("RINGCENTRAL_CLIENT_ID");
  const clientSecret = Deno.env.get("RINGCENTRAL_CLIENT_SECRET");
  const jwt = Deno.env.get("RINGCENTRAL_JWT");

  if (!clientId || !clientSecret || !jwt) {
    throw new Error("RingCentral credentials not configured");
  }

  const credentials = btoa(`${clientId}:${clientSecret}`);

  const response = await fetch(`${RC_SERVER}/restapi/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    throw new Error(`RC token exchange failed: ${await response.text()}`);
  }

  const data = await response.json();
  return data.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const userId = await verifyAuth(req);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // Action: return the client ID (publishable, needed by the widget)
    if (action === "client-id") {
      const clientId = Deno.env.get("RINGCENTRAL_CLIENT_ID");
      if (!clientId) {
        return new Response(
          JSON.stringify({ error: "RINGCENTRAL_CLIENT_ID not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({ clientId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: proxy a recording download
    if (action === "recording") {
      const recordingUri = url.searchParams.get("uri");
      if (!recordingUri) {
        return new Response(
          JSON.stringify({ error: "Missing recording uri parameter" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate the URI is actually a RingCentral media URL
      if (!recordingUri.includes("media.ringcentral.com") && !recordingUri.includes("platform.ringcentral.com") && !recordingUri.includes("media.devtest.ringcentral.com") && !recordingUri.includes("platform.devtest.ringcentral.com")) {
        return new Response(
          JSON.stringify({ error: "Invalid recording URI" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const accessToken = await getRCAccessToken();

      const rcResponse = await fetch(recordingUri, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!rcResponse.ok) {
        throw new Error(`Failed to fetch recording: ${rcResponse.status}`);
      }

      const audioData = await rcResponse.arrayBuffer();
      const contentType = rcResponse.headers.get("Content-Type") || "audio/mpeg";

      return new Response(audioData, {
        headers: {
          ...corsHeaders,
          "Content-Type": contentType,
          "Content-Disposition": "inline",
          "Cache-Control": "private, max-age=3600",
        },
      });
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use ?action=client-id or ?action=recording&uri=..." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("RingCentral recording error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
