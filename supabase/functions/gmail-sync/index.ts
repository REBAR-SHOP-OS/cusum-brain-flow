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

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  return user.id;
}

async function getAccessTokenForUser(userId: string, clientIp: string): Promise<string> {
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

  // Track usage for anomaly detection
  await supabaseAdmin
    .from("user_gmail_tokens")
    .update({ last_used_at: new Date().toISOString(), last_used_ip: clientIp })
    .eq("user_id", userId);

  return data.access_token;
}

interface GmailAttachment {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
  partId: string;
}

interface GmailPart {
  partId?: string;
  mimeType: string;
  filename?: string;
  body?: { data?: string; size?: number; attachmentId?: string };
  parts?: GmailPart[];
}

interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  labelIds?: string[];
  payload: {
    headers: Array<{ name: string; value: string }>;
    body?: { data?: string };
    parts?: GmailPart[];
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

/** Strip dangerous HTML server-side before persisting (defense-in-depth). */
function sanitizeHtmlServerSide(html: string): string {
  // Remove script/iframe/object/embed/form tags and their content
  let clean = html.replace(/<\s*(script|iframe|object|embed|form|applet|base|link|meta|style)\b[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, "");
  // Remove self-closing variants
  clean = clean.replace(/<\s*(script|iframe|object|embed|form|applet|base|link|meta)\b[^>]*\/?>/gi, "");
  // Remove event handler attributes (on*)
  clean = clean.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  // Remove javascript: / data: / vbscript: in href/src/action attributes
  clean = clean.replace(/(href|src|action)\s*=\s*(?:"(?:javascript|data|vbscript):[^"]*"|'(?:javascript|data|vbscript):[^']*')/gi, "$1=\"\"");
  return clean;
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

function extractAttachments(payload: GmailMessage["payload"]): GmailAttachment[] {
  const attachments: GmailAttachment[] = [];

  function walkParts(parts?: GmailPart[]) {
    if (!parts) return;
    for (const part of parts) {
      if (part.filename && part.filename.length > 0 && part.body?.attachmentId) {
        attachments.push({
          filename: part.filename,
          mimeType: part.mimeType,
          size: part.body.size || 0,
          attachmentId: part.body.attachmentId,
          partId: part.partId || "",
        });
      }
      if (part.parts) walkParts(part.parts);
    }
  }

  walkParts(payload.parts);
  return attachments;
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

    // Get the user's own Gmail access token with IP tracking
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const accessToken = await getAccessTokenForUser(userId, clientIp);

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

        const attachments = extractAttachments(msgData.payload);

        return {
          id: msgData.id,
          threadId: msgData.threadId,
          from: getHeader(headers, "From"),
          to: getHeader(headers, "To"),
          subject: getHeader(headers, "Subject"),
          date: getHeader(headers, "Date"),
          snippet: msgData.snippet,
          body: sanitizeHtmlServerSide(getBodyContent(msgData)),
          internalDate: parseInt(msgData.internalDate),
          isUnread: msgData.labelIds?.includes("UNREAD") || false,
          attachments,
        };
      })
    );

    const validMessages = messages.filter(Boolean);

    // Upsert into communications
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

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
        JSON.stringify({ error: "no_company", message: "No company found for your account." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
          metadata: {
            body: msg.body,
            date: msg.date,
            ...(msg.attachments && msg.attachments.length > 0 ? {
              attachments: msg.attachments.map(a => ({
                filename: a.filename,
                mimeType: a.mimeType,
                size: a.size,
                attachmentId: a.attachmentId,
              })),
            } : {}),
          },
          user_id: userId,
          company_id: companyId,
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