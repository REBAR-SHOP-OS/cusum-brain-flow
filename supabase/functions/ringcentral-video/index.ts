import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

async function getAccessToken(): Promise<string> {
  const clientId = Deno.env.get("RINGCENTRAL_JWT_CLIENT_ID");
  const clientSecret = Deno.env.get("RINGCENTRAL_JWT_CLIENT_SECRET");
  const jwt = Deno.env.get("RINGCENTRAL_JWT");

  if (!clientId || !clientSecret || !jwt) {
    throw new Error("RingCentral JWT app credentials not configured");
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
    const error = await response.text();
    throw new Error(`RingCentral token exchange failed: ${error}`);
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
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action, meetingName, meetingType } = body;

    const accessToken = await getAccessToken();

    if (action === "create") {
      // Create a RingCentral Video meeting bridge
      const bridgePayload: Record<string, unknown> = {
        name: meetingName || "Team Meeting",
        type: "Instant",
        security: {
          passwordProtected: false,
          noGuests: false,
          sameAccount: false,
          e2ee: false,
        },
        preferences: {
          join: {
            audioMuted: meetingType === "screen_share",
            videoMuted: meetingType === "audio" || meetingType === "screen_share",
            waitingRoomRequired: "Nobody",
          },
          playTones: "Off",
          musicOnHold: false,
          joinBeforeHost: true,
          screenSharing: true,
          recordingsMode: "User",
          transcriptionsMode: "User",
          allowEveryoneTranscribeMeetings: true,
        },
      };

      const createResponse = await fetch(`${RC_SERVER}/rcvideo/v2/bridges`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bridgePayload),
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error("RCV bridge creation failed:", createResponse.status, errorText);

        // If Video API isn't available, provide helpful error
        if (createResponse.status === 403) {
          return new Response(
            JSON.stringify({
              error: "RingCentral Video permissions not enabled. Please add 'Video' permission to your RingCentral app.",
              fallback: true,
            }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        throw new Error(`RCV bridge creation failed [${createResponse.status}]: ${errorText}`);
      }

      const bridge = await createResponse.json();

      // Extract the web join URL
      const joinUrl = bridge.discovery?.web || bridge.web || `https://v.ringcentral.com/join/${bridge.id}`;
      const hostUrl = bridge.discovery?.webHost || joinUrl;

      return new Response(
        JSON.stringify({
          success: true,
          bridgeId: bridge.id,
          shortId: bridge.shortId,
          joinUrl,
          hostUrl,
          pin: bridge.pins?.web || null,
          pstnPin: bridge.pins?.pstn || null,
          dialInNumbers: bridge.discovery?.pstnNumbers || [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("RingCentral Video error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        fallback: true,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
