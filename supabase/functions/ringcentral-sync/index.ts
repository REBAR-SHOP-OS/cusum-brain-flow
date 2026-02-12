import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RC_SERVER = "https://platform.ringcentral.com";

interface CallLogRecord {
  id: string;
  sessionId: string;
  startTime: string;
  duration: number;
  type: string;
  direction: string;
  action: string;
  result: string;
  from: { phoneNumber?: string; name?: string };
  to: { phoneNumber?: string; name?: string };
  recording?: {
    id: string;
    contentUri: string;
    type: string;
  };
}

interface MessageRecord {
  id: string;
  conversationId: string;
  creationTime: string;
  direction: string;
  type: string;
  readStatus: string;
  subject?: string;
  from: { phoneNumber?: string; name?: string };
  to: Array<{ phoneNumber?: string; name?: string }>;
}

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

/**
 * Get an access token for the given user.
 * Priority:
 *   1. Per-user OAuth token from user_ringcentral_tokens
 *   2. Fallback to shared JWT credentials (for backward compat / auto-migration)
 */
async function getAccessTokenForUser(
  userId: string,
  supabaseAdmin: ReturnType<typeof createClient>
): Promise<string> {
  // 1. Check per-user tokens
  const { data: tokenRow } = await supabaseAdmin
    .from("user_ringcentral_tokens")
    .select("refresh_token, access_token, token_expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (tokenRow) {
    // Check if it's a JWT-migrated token
    if (tokenRow.refresh_token.startsWith("jwt:")) {
      const jwt = tokenRow.refresh_token.replace("jwt:", "");
      return await exchangeJwtToken(jwt);
    }

    // Check if current access token is still valid
    if (tokenRow.access_token && tokenRow.token_expires_at) {
      const expiresAt = new Date(tokenRow.token_expires_at);
      if (expiresAt > new Date(Date.now() + 60_000)) {
        return tokenRow.access_token;
      }
    }

    // Refresh using OAuth refresh token
    const clientId = Deno.env.get("RINGCENTRAL_CLIENT_ID");
    const clientSecret = Deno.env.get("RINGCENTRAL_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      throw new Error("RingCentral OAuth client credentials not configured");
    }

    const credentials = btoa(`${clientId}:${clientSecret}`);
    const response = await fetch(`${RC_SERVER}/restapi/oauth/token`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: tokenRow.refresh_token,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // If refresh token is expired/revoked, clean up and treat as disconnected
      if (errorText.includes("invalid_grant") || errorText.includes("Token not found")) {
        console.warn("RingCentral refresh token expired, clearing stale tokens for user", userId);
        await supabaseAdmin
          .from("user_ringcentral_tokens")
          .delete()
          .eq("user_id", userId);
        throw new Error("not_connected");
      }
      throw new Error(`RingCentral token refresh failed: ${errorText}`);
    }

    const tokens = await response.json();

    // Update stored tokens
    await supabaseAdmin
      .from("user_ringcentral_tokens")
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || tokenRow.refresh_token,
        token_expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
      })
      .eq("user_id", userId);

    return tokens.access_token;
  }

  // 2. Fallback: shared JWT credentials (auto-migrate if email matches)
  const jwt = Deno.env.get("RINGCENTRAL_JWT");
  if (!jwt) {
    throw new Error("not_connected");
  }

  const accessToken = await exchangeJwtToken(jwt);

  // Check if this JWT matches the user's email
  const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
  const userEmail = userData?.user?.email?.toLowerCase();

  let rcEmail = "";
  try {
    const extRes = await fetch(`${RC_SERVER}/restapi/v1.0/account/~/extension/~`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (extRes.ok) {
      const extData = await extRes.json();
      rcEmail = (extData.contact?.email || "").toLowerCase();
    }
  } catch {
    // continue
  }

  if (rcEmail && userEmail && rcEmail !== userEmail) {
    throw new Error("not_connected");
  }

  // Auto-migrate: store for this user
  if (rcEmail && userEmail && rcEmail === userEmail) {
    await supabaseAdmin.from("user_ringcentral_tokens").upsert({
      user_id: userId,
      rc_email: rcEmail,
      refresh_token: `jwt:${jwt}`,
      access_token: accessToken,
      token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
    }, { onConflict: "user_id" });
  }

  return accessToken;
}

async function exchangeJwtToken(jwt: string): Promise<string> {
  const clientId = Deno.env.get("RINGCENTRAL_JWT_CLIENT_ID");
  const clientSecret = Deno.env.get("RINGCENTRAL_JWT_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error("RingCentral JWT app credentials not configured");
  }

  const credentials = btoa(`${clientId}:${clientSecret}`);

  const response = await fetch(`${RC_SERVER}/restapi/oauth/token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`RingCentral JWT token exchange failed: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function fetchCallLog(accessToken: string, dateFrom: string): Promise<CallLogRecord[]> {
  const params = new URLSearchParams({
    dateFrom,
    perPage: "100",
    view: "Detailed",
  });

  const response = await fetch(
    `${RC_SERVER}/restapi/v1.0/account/~/extension/~/call-log?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch call log: ${await response.text()}`);
  }

  const data = await response.json();
  return data.records || [];
}

async function fetchMessages(accessToken: string, dateFrom: string): Promise<MessageRecord[]> {
  const params = new URLSearchParams({
    dateFrom,
    perPage: "100",
    messageType: "SMS",
  });

  const response = await fetch(
    `${RC_SERVER}/restapi/v1.0/account/~/extension/~/message-store?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch messages: ${await response.text()}`);
  }

  const data = await response.json();
  return data.records || [];
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

    let body: { syncType?: string; daysBack?: number } = {};
    try {
      body = await req.json();
    } catch {
      // Use defaults
    }

    const syncType = body.syncType || "all";
    const daysBack = body.daysBack || 7;
    const dateFrom = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get access token for this specific user
    let accessToken: string;
    try {
      accessToken = await getAccessTokenForUser(userId, supabaseAdmin);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (msg === "not_connected") {
        return new Response(
          JSON.stringify({
            error: "not_connected",
            message: "RingCentral is not connected for your account. Please connect it in Inbox settings.",
            callsUpserted: 0,
            smsUpserted: 0,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw err;
    }

    // Look up the user's company_id
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("user_id", userId)
      .maybeSingle();
    const companyId = profile?.company_id;
    if (!companyId) {
      console.error("No company_id found for user", userId);
      return new Response(
        JSON.stringify({
          error: "no_company",
          message: "No company found for your account.",
          callsUpserted: 0,
          smsUpserted: 0,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let callsUpserted = 0;
    let smsUpserted = 0;

    // Sync calls
    if (syncType === "calls" || syncType === "all") {
      const calls = await fetchCallLog(accessToken, dateFrom);

      for (const call of calls) {
        const { error } = await supabaseAdmin
          .from("communications")
          .upsert({
            source: "ringcentral",
            source_id: call.id,
            thread_id: call.sessionId,
            from_address: call.from?.phoneNumber || call.from?.name || "Unknown",
            to_address: call.to?.phoneNumber || call.to?.name || "Unknown",
            subject: `${call.direction} call - ${call.result}`,
            body_preview: `Duration: ${Math.floor(call.duration / 60)}m ${call.duration % 60}s | ${call.action}`,
            received_at: call.startTime,
            direction: call.direction.toLowerCase(),
            status: call.result === "Missed" ? "unread" : "read",
            metadata: {
              type: "call",
              duration: call.duration,
              action: call.action,
              result: call.result,
              ...(call.recording ? {
                recording_id: call.recording.id,
                recording_uri: call.recording.contentUri,
                recording_type: call.recording.type,
              } : {}),
            },
            user_id: userId,
            company_id: companyId,
          }, {
            onConflict: "source,source_id",
            ignoreDuplicates: false,
          });

        if (!error) {
          callsUpserted++;
          // Write activity event
          await supabaseAdmin.from("activity_events").upsert({
            entity_type: "communication",
            entity_id: call.id,
            event_type: "call_logged",
            actor_id: userId,
            actor_type: "system",
            description: `${call.direction} call ${call.from?.phoneNumber || "?"} → ${call.to?.phoneNumber || "?"}: ${call.result}`,
            company_id: companyId,
            source: "ringcentral",
            dedupe_key: `rc:${call.id}`,
            metadata: { direction: call.direction, result: call.result, duration: call.duration },
          }, { onConflict: "dedupe_key", ignoreDuplicates: true });
        }
      }
    }

    // Sync SMS
    if (syncType === "sms" || syncType === "all") {
      const messages = await fetchMessages(accessToken, dateFrom);

      for (const msg of messages) {
        const toAddress = msg.to?.map(t => t.phoneNumber || t.name).join(", ") || "Unknown";

        const { error } = await supabaseAdmin
          .from("communications")
          .upsert({
            source: "ringcentral",
            source_id: String(msg.id),
            thread_id: msg.conversationId,
            from_address: msg.from?.phoneNumber || msg.from?.name || "Unknown",
            to_address: toAddress,
            subject: msg.subject || "SMS",
            body_preview: msg.subject || "",
            received_at: msg.creationTime,
            direction: msg.direction.toLowerCase(),
            status: msg.readStatus === "Unread" ? "unread" : "read",
            metadata: {
              type: "sms",
            },
            user_id: userId,
            company_id: companyId,
          }, {
            onConflict: "source,source_id",
            ignoreDuplicates: false,
          });

        if (!error) {
          smsUpserted++;
          // Write activity event
          await supabaseAdmin.from("activity_events").upsert({
            entity_type: "communication",
            entity_id: String(msg.id),
            event_type: "sms_received",
            actor_id: userId,
            actor_type: "system",
            description: `SMS ${msg.direction} ${msg.from?.phoneNumber || "?"} → ${toAddress}`,
            company_id: companyId,
            source: "ringcentral",
            dedupe_key: `rc:${msg.id}`,
            metadata: { direction: msg.direction, type: "sms" },
          }, { onConflict: "dedupe_key", ignoreDuplicates: true });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        callsUpserted,
        smsUpserted,
        dateFrom,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("RingCentral sync error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
