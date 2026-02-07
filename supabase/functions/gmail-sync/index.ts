import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

async function getAccessTokenForUser(userId: string): Promise<string> {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Look up per-user token first
  const { data: tokenRow } = await supabaseAdmin
    .from("user_gmail_tokens")
    .select("refresh_token")
    .eq("user_id", userId)
    .maybeSingle();

  let refreshToken = tokenRow?.refresh_token;

  // Fallback: if no per-user token, check the shared env var
  // but only allow it if the user's email matches the Gmail account
  if (!refreshToken) {
    const sharedToken = Deno.env.get("GMAIL_REFRESH_TOKEN");
    if (sharedToken) {
      // Verify the user owns this Gmail account
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
      const userEmail = userData?.user?.email?.toLowerCase();

      // Quick check: try to get Gmail profile with shared token
      const clientId = Deno.env.get("GMAIL_CLIENT_ID");
      const clientSecret = Deno.env.get("GMAIL_CLIENT_SECRET");
      if (clientId && clientSecret) {
        const checkRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: sharedToken,
            grant_type: "refresh_token",
          }),
        });
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          const profileRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
            headers: { Authorization: `Bearer ${checkData.access_token}` },
          });
          if (profileRes.ok) {
            const profile = await profileRes.json();
            const gmailEmail = (profile.emailAddress || "").toLowerCase();
            if (gmailEmail === userEmail) {
              // User matches — auto-migrate their token to the DB
              await supabaseAdmin.from("user_gmail_tokens").upsert({
                user_id: userId,
                gmail_email: gmailEmail,
                refresh_token: sharedToken,
              }, { onConflict: "user_id" });
              refreshToken = sharedToken;
            }
          }
        }
      }
    }
  }

  if (!refreshToken) {
    throw new Error("Gmail not connected. Please connect your Gmail account from Inbox settings.");
  }

  const clientId = Deno.env.get("GMAIL_CLIENT_ID");
  const clientSecret = Deno.env.get("GMAIL_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error("Gmail OAuth credentials not configured");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    // If token is invalid, clean up
    if (error.includes("invalid_grant")) {
      await supabaseAdmin.from("user_gmail_tokens").delete().eq("user_id", userId);
      throw new Error("Gmail token expired. Please reconnect your Gmail account.");
    }
    throw new Error(`Token refresh failed: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  labelIds?: string[];
  payload: {
    headers: Array<{ name: string; value: string }>;
    body?: { data?: string };
    parts?: Array<{ mimeType: string; body?: { data?: string } }>;
  };
  internalDate: string;
}

interface ListMessagesResponse {
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
  } catch {
    return atob(base64);
  }
}

function getHeader(headers: Array<{ name: string; value: string }>, name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
}

function getBodyContent(message: GmailMessage): string {
  if (message.payload.body?.data) {
    return decodeBase64Url(message.payload.body.data);
  }
  const textPart = message.payload.parts?.find((p) => p.mimeType === "text/plain");
  if (textPart?.body?.data) {
    return decodeBase64Url(textPart.body.data);
  }
  return message.snippet;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const clonedReq = req.clone();

    const userId = await verifyAuth(req);
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the user's own Gmail access token
    const accessToken = await getAccessTokenForUser(userId);

    // Parse body for parameters
    let body: { maxResults?: number; pageToken?: string; query?: string } = {};
    try {
      body = await clonedReq.json();
    } catch {
      // No body or invalid JSON
    }

    const maxResults = String(body.maxResults ?? 20);
    const pageToken = body.pageToken ?? "";
    const query = body.query ?? "";

    // List messages
    const listParams = new URLSearchParams({
      maxResults,
      ...(pageToken && { pageToken }),
      ...(query && { q: query }),
    });

    const listResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?${listParams}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!listResponse.ok) {
      throw new Error(`Gmail API error: ${await listResponse.text()}`);
    }

    const listData: ListMessagesResponse = await listResponse.json();

    if (!listData.messages?.length) {
      return new Response(
        JSON.stringify({ messages: [], nextPageToken: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch full message details
    const messages = await Promise.all(
      listData.messages.map(async (msg) => {
        const msgResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!msgResponse.ok) return null;

        const msgData: GmailMessage = await msgResponse.json();
        const headers = msgData.payload.headers;

        return {
          id: msgData.id,
          threadId: msgData.threadId,
          from: getHeader(headers, "From"),
          to: getHeader(headers, "To"),
          subject: getHeader(headers, "Subject"),
          date: getHeader(headers, "Date"),
          snippet: msgData.snippet,
          body: getBodyContent(msgData),
          internalDate: parseInt(msgData.internalDate),
          isUnread: msgData.labelIds?.includes("UNREAD") || false,
        };
      })
    );

    const validMessages = messages.filter(Boolean);

    // Upsert into communications
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    for (const msg of validMessages) {
      if (!msg) continue;

      const { error: upsertError } = await supabaseAdmin
        .from("communications")
        .upsert({
          source: "gmail",
          source_id: msg.id,
          thread_id: msg.threadId,
          from_address: msg.from,
          to_address: msg.to,
          subject: msg.subject,
          body_preview: msg.snippet,
          received_at: new Date(msg.internalDate).toISOString(),
          direction: "inbound",
          status: msg.isUnread ? "unread" : "read",
          metadata: { body: msg.body, date: msg.date },
          user_id: userId,
        }, {
          onConflict: "source,source_id",
          ignoreDuplicates: false,
        });

      if (upsertError) {
        console.error("Failed to upsert communication:", upsertError);
      }
    }

    return new Response(
      JSON.stringify({
        messages: validMessages,
        nextPageToken: listData.nextPageToken || null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Gmail sync error:", error);

    // Return specific error for "not connected" so UI can handle it
    const message = error instanceof Error ? error.message : "Unknown error";
    const isNotConnected = message.includes("not connected") || message.includes("reconnect");

    return new Response(
      JSON.stringify({
        error: isNotConnected ? "gmail_not_connected" : "sync_error",
        message,
      }),
      {
        status: isNotConnected ? 403 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});