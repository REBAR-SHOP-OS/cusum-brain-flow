import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RC_SERVER = "https://platform.ringcentral.com";

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

async function getRCAccessTokenForUser(userId: string): Promise<string> {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: tokenRow, error } = await supabaseAdmin
    .from("user_ringcentral_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .single();

  if (error || !tokenRow?.access_token) {
    throw new Error("RingCentral not connected. Please connect RingCentral in Integrations.");
  }

  // Check if token is expired and refresh if needed
  const expiresAt = new Date(tokenRow.expires_at).getTime();
  if (Date.now() < expiresAt - 60000) {
    return tokenRow.access_token;
  }

  // Refresh the token
  const clientId = Deno.env.get("RINGCENTRAL_CLIENT_ID");
  const clientSecret = Deno.env.get("RINGCENTRAL_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("RC OAuth credentials not configured");

  const resp = await fetch(`${RC_SERVER}/restapi/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokenRow.refresh_token,
    }),
  });

  if (!resp.ok) throw new Error(`Token refresh failed: ${resp.status}`);

  const tokens = await resp.json();
  await supabaseAdmin
    .from("user_ringcentral_tokens")
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    })
    .eq("user_id", userId);

  return tokens.access_token;
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
      if (!recordingUri.includes("media.ringcentral.com") && !recordingUri.includes("platform.ringcentral.com")) {
        return new Response(
          JSON.stringify({ error: "Invalid recording URI" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const accessToken = await getRCAccessTokenForUser(userId);

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
