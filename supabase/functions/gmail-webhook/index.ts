import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decryptToken } from "../_shared/tokenEncryption.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Refresh a Gmail access token */
async function refreshGmailToken(refreshToken: string): Promise<string | null> {
  const clientId = Deno.env.get("GMAIL_CLIENT_ID");
  const clientSecret = Deno.env.get("GMAIL_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.access_token || null;
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return decodeURIComponent(
      atob(base64).split("").map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join("")
    );
  } catch {
    return atob(base64);
  }
}

function getHeader(headers: Array<{ name: string; value: string }>, name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
}

function sanitizeHtmlServerSide(html: string): string {
  let clean = html.replace(/<\s*(script|iframe|object|embed|form|applet|base|link|meta|style)\b[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, "");
  clean = clean.replace(/<\s*(script|iframe|object|embed|form|applet|base|link|meta)\b[^>]*\/?>/gi, "");
  clean = clean.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  clean = clean.replace(/(href|src|action)\s*=\s*(?:"(?:javascript|data|vbscript):[^"]*"|'(?:javascript|data|vbscript):[^']*')/gi, '$1=""');
  return clean;
}

function findPartByMime(parts: any[] | undefined, mime: string): any | undefined {
  if (!parts) return undefined;
  for (const part of parts) {
    if (part.mimeType === mime && part.body?.data) return part;
    if (part.parts) {
      const nested = findPartByMime(part.parts, mime);
      if (nested) return nested;
    }
  }
  return undefined;
}

function getBodyContent(message: any): string {
  if (message.payload?.body?.data) return decodeBase64Url(message.payload.body.data);
  const htmlPart = findPartByMime(message.payload?.parts, "text/html");
  if (htmlPart?.body?.data) return decodeBase64Url(htmlPart.body.data);
  const textPart = findPartByMime(message.payload?.parts, "text/plain");
  if (textPart?.body?.data) return decodeBase64Url(textPart.body.data);
  return message.snippet || "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Only accept POST (Pub/Sub push)
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json();

    // Pub/Sub push format: { message: { data: base64, messageId, publishTime }, subscription }
    const pubsubMessage = body?.message;
    if (!pubsubMessage?.data) {
      return new Response(JSON.stringify({ error: "Invalid Pub/Sub message" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Decode the Pub/Sub data
    const decoded = atob(pubsubMessage.data);
    let notification: { emailAddress?: string; historyId?: string };
    try {
      notification = JSON.parse(decoded);
    } catch {
      console.error("Failed to parse Pub/Sub data:", decoded);
      return new Response("OK", { status: 200 }); // ACK to prevent retries
    }

    const { emailAddress, historyId } = notification;
    if (!emailAddress || !historyId) {
      console.warn("Missing emailAddress or historyId in Pub/Sub notification");
      return new Response("OK", { status: 200 });
    }

    console.log(`Gmail push notification: ${emailAddress}, historyId: ${historyId}`);

    // Rate limit: check if we processed this historyId recently
    const { data: recentEvent } = await supabase
      .from("activity_events")
      .select("id")
      .eq("dedupe_key", `gmail_push:${emailAddress}:${historyId}`)
      .maybeSingle();

    if (recentEvent) {
      console.log("Duplicate Pub/Sub notification, skipping");
      return new Response("OK", { status: 200 });
    }

    // Look up user by Gmail email
    const { data: tokenRow } = await supabase
      .from("user_gmail_tokens")
      .select("user_id, refresh_token, is_encrypted, last_history_id")
      .eq("gmail_email", emailAddress.toLowerCase())
      .maybeSingle();

    if (!tokenRow) {
      console.warn(`No Gmail token found for ${emailAddress}`);
      return new Response("OK", { status: 200 });
    }

    // Get user's company_id
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("user_id", tokenRow.user_id)
      .maybeSingle();

    if (!profile?.company_id) {
      console.warn(`No company for user ${tokenRow.user_id}`);
      return new Response("OK", { status: 200 });
    }
    const companyId = profile.company_id;

    // Decrypt refresh token if needed
    let refreshToken = tokenRow.refresh_token;
    if (tokenRow.is_encrypted) {
      try {
        refreshToken = await decryptToken(refreshToken);
      } catch {
        console.error("Failed to decrypt Gmail token");
        return new Response("OK", { status: 200 });
      }
    }

    // Get access token
    const accessToken = await refreshGmailToken(refreshToken);
    if (!accessToken) {
      console.error("Failed to refresh Gmail token for", emailAddress);
      return new Response("OK", { status: 200 });
    }

    // Fetch history since last known historyId
    const startHistoryId = tokenRow.last_history_id || historyId;
    const historyUrl = `https://gmail.googleapis.com/gmail/v1/users/me/history?startHistoryId=${startHistoryId}&historyTypes=messageAdded`;
    const historyRes = await fetch(historyUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!historyRes.ok) {
      const errText = await historyRes.text();
      // 404 means historyId is too old, need full sync
      if (historyRes.status === 404) {
        console.warn("History too old for", emailAddress, "- skipping incremental, needs full sync");
      } else {
        console.error("Gmail history.list error:", historyRes.status, errText);
      }
      // Update historyId anyway to avoid replaying
      await supabase
        .from("user_gmail_tokens")
        .update({ last_history_id: historyId })
        .eq("user_id", tokenRow.user_id);
      return new Response("OK", { status: 200 });
    }

    const historyData = await historyRes.json();
    const messageIds = new Set<string>();

    // Extract new message IDs from history
    for (const record of historyData.history || []) {
      for (const added of record.messagesAdded || []) {
        if (added.message?.id) {
          messageIds.add(added.message.id);
        }
      }
    }

    console.log(`Found ${messageIds.size} new messages for ${emailAddress}`);

    const activityEvents: any[] = [];

    // Fetch and upsert each new message
    for (const msgId of messageIds) {
      try {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!msgRes.ok) continue;

        const msgData = await msgRes.json();
        const headers = msgData.payload?.headers || [];

        const from = getHeader(headers, "From");
        const to = getHeader(headers, "To");
        const subject = getHeader(headers, "Subject");
        const bodyContent = sanitizeHtmlServerSide(getBodyContent(msgData));
        const isUnread = msgData.labelIds?.includes("UNREAD") || false;

        const { error: upsertError } = await supabase
          .from("communications")
          .upsert({
            source: "gmail",
            source_id: msgId,
            thread_id: msgData.threadId,
            from_address: from,
            to_address: to,
            subject,
            body_preview: bodyContent
              ? bodyContent.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300)
              : msgData.snippet,
            received_at: new Date(parseInt(msgData.internalDate)).toISOString(),
            direction: "inbound",
            status: isUnread ? "unread" : "read",
            metadata: { body: bodyContent, date: getHeader(headers, "Date") },
            user_id: tokenRow.user_id,
            company_id: companyId,
          }, {
            onConflict: "source,source_id",
            ignoreDuplicates: false,
          });

        if (upsertError) {
          console.error("Upsert error for msg", msgId, upsertError);
        } else {
          activityEvents.push({
            entity_type: "communication",
            entity_id: msgId,
            event_type: "email_received",
            actor_id: tokenRow.user_id,
            actor_type: "system",
            description: `Email from ${from}: ${subject?.slice(0, 80) || "(no subject)"}`,
            company_id: companyId,
            source: "gmail",
            dedupe_key: `gmail:${msgId}`,
            metadata: { from, to, subject, threadId: msgData.threadId },
          });
        }
      } catch (msgErr) {
        console.error("Error processing message", msgId, msgErr);
      }
    }

    // Write activity events
    if (activityEvents.length > 0) {
      const { error: evtErr } = await supabase
        .from("activity_events")
        .upsert(activityEvents, { onConflict: "dedupe_key", ignoreDuplicates: true });
      if (evtErr) console.error("Failed to write activity events:", evtErr);
    }

    // Update last_history_id
    await supabase
      .from("user_gmail_tokens")
      .update({ last_history_id: historyId })
      .eq("user_id", tokenRow.user_id);

    // Log the push processing event
    await supabase.from("activity_events").upsert({
      entity_type: "gmail_push",
      entity_id: emailAddress,
      event_type: "gmail_push_processed",
      actor_type: "system",
      description: `Processed ${messageIds.size} messages from Gmail push for ${emailAddress}`,
      company_id: companyId,
      source: "gmail",
      dedupe_key: `gmail_push:${emailAddress}:${historyId}`,
      metadata: { historyId, messageCount: messageIds.size },
    }, { onConflict: "dedupe_key", ignoreDuplicates: true });

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("gmail-webhook error:", error);
    // R16-3: Differentiate transient vs permanent errors
    // Transient errors (DB, network, decryption) → 500 so Pub/Sub retries
    // Permanent errors (bad data, missing user) → 200 to stop retries
    const errMsg = String(error);
    const isTransient = /connect|timeout|network|ECONNREFUSED|database|pool|decrypt/i.test(errMsg);
    if (isTransient) {
      console.warn("gmail-webhook: transient error, returning 500 for retry");
      return new Response("Transient error", { status: 500 });
    }
    return new Response("OK", { status: 200 });
  }
});
