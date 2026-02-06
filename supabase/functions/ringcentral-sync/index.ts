import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RC_SERVER = "https://platform.ringcentral.com";

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

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

async function getAccessToken(): Promise<string> {
  // Use dedicated JWT app credentials (separate from widget OAuth app)
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
    throw new Error(`RingCentral token exchange failed: ${error}`);
  }

  const data: TokenResponse = await response.json();
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
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
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
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
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

    // Parse body for parameters
    let body: { syncType?: string; daysBack?: number } = {};
    try {
      body = await req.json();
    } catch {
      // Use defaults
    }

    const syncType = body.syncType || "all"; // "calls", "sms", or "all"
    const daysBack = body.daysBack || 7;

    const dateFrom = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
    const accessToken = await getAccessToken();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

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
          }, {
            onConflict: "source,source_id",
            ignoreDuplicates: false,
          });

        if (!error) callsUpserted++;
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
          }, {
            onConflict: "source,source_id",
            ignoreDuplicates: false,
          });

        if (!error) smsUpserted++;
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
