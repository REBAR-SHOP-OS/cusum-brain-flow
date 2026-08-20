import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";

const RC_SERVER = "https://platform.ringcentral.com";

/** Get a valid RC access token for the user, refreshing if expired */
async function getAccessTokenForUser(serviceClient: any, userId: string): Promise<string> {
  const { data: tokenRow, error } = await serviceClient
    .from("user_ringcentral_tokens")
    .select("access_token, refresh_token, token_expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !tokenRow?.refresh_token || tokenRow.refresh_token === "pending") {
    throw new Error("RingCentral not connected. Please connect RingCentral in Integrations first.");
  }

  // If token is still valid, use it
  if (tokenRow.access_token && tokenRow.token_expires_at) {
    const expiresAt = new Date(tokenRow.token_expires_at).getTime();
    if (expiresAt > Date.now() + 60_000) {
      return tokenRow.access_token;
    }
  }

  // Refresh the token
  const clientId = Deno.env.get("RINGCENTRAL_CLIENT_ID");
  const clientSecret = Deno.env.get("RINGCENTRAL_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("RingCentral OAuth credentials not configured");
  }

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

  if (!resp.ok) {
    const errText = await resp.text();
    console.error("RC token refresh failed:", errText);
    throw new Error("RingCentral token expired. Please reconnect in Integrations.");
  }

  const tokens = await resp.json();
  await serviceClient
    .from("user_ringcentral_tokens")
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || tokenRow.refresh_token,
      token_expires_at: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString(),
    })
    .eq("user_id", userId);

  return tokens.access_token;
}

Deno.serve((req) =>
  handleRequest(req, async ({ userId, serviceClient, body }) => {
    const { action, meetingName, meetingType } = body;

    let accessToken: string;
    try {
      accessToken = await getAccessTokenForUser(serviceClient, userId);
    } catch (e) {
      // Graceful fallback — user hasn't connected RC
      return { success: false, error: (e as Error).message, fallback: true };
    }

    if (action === "create") {
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

      const createResponse = await fetch(`${RC_SERVER}/rcvideo/v2/account/~/extension/~/bridges`, {
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

        if (createResponse.status === 403) {
          return {
            success: false,
            error: "RingCentral Video permissions not enabled on your account.",
            fallback: true,
          };
        }

        return { success: false, error: `RCV bridge failed [${createResponse.status}]`, fallback: true };
      }

      const bridge = await createResponse.json();
      const joinUrl = bridge.discovery?.web || bridge.web || `https://v.ringcentral.com/join/${bridge.id}`;
      const hostUrl = bridge.discovery?.webHost || joinUrl;

      return {
        success: true,
        bridgeId: bridge.id,
        shortId: bridge.shortId,
        joinUrl,
        hostUrl,
        pin: bridge.pins?.web || null,
        pstnPin: bridge.pins?.pstn || null,
        dialInNumbers: bridge.discovery?.pstnNumbers || [],
      };
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }, { functionName: "ringcentral-video", requireCompany: false, wrapResult: false })
);
