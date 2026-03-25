import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptToken, decryptToken } from "../_shared/tokenEncryption.ts";

import { corsHeaders } from "../_shared/auth.ts";

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
    .select("refresh_token, is_encrypted")
    .eq("user_id", userId)
    .maybeSingle();

  let refreshToken = tokenRow?.refresh_token;
  // Decrypt if stored encrypted
  if (refreshToken && tokenRow?.is_encrypted) {
    refreshToken = await decryptToken(refreshToken);
  }

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
              // User matches — auto-migrate their token to the DB (encrypted)
              const encMigrated = await encryptToken(sharedToken);
              await supabaseAdmin.from("user_gmail_tokens").upsert({
                user_id: userId,
                gmail_email: gmailEmail,
                refresh_token: encMigrated,
                is_encrypted: true,
                token_rotated_at: new Date().toISOString(),
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

  // Token rotation: if Google issued a new refresh token, encrypt & store it
  if (data.refresh_token) {
    const encNew = await encryptToken(data.refresh_token);
    await supabaseAdmin
      .from("user_gmail_tokens")
      .update({ refresh_token: encNew, is_encrypted: true, token_rotated_at: new Date().toISOString() })
      .eq("user_id", userId);
  }

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
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return atob(base64);
  }
}

/** Decode HTML entities in Gmail snippets (e.g. &#39; &hellip; &amp;) */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&hellip;/g, "…")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&lsquo;/g, "\u2018")
    .replace(/&rsquo;/g, "\u2019")
    .replace(/&ldquo;/g, "\u201C")
    .replace(/&rdquo;/g, "\u201D")
    .replace(/&bull;/g, "•")
    .replace(/&nbsp;/g, " ");
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

function findPartByMime(parts: GmailPart[] | undefined, mime: string): GmailPart | undefined {
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

function getBodyContent(message: GmailMessage): string {
  // Direct body (simple messages)
  if (message.payload.body?.data) {
    return decodeBase64Url(message.payload.body.data);
  }

  // Prefer HTML for rich emails
  const htmlPart = findPartByMime(message.payload.parts, "text/html");
  if (htmlPart?.body?.data) {
    return decodeBase64Url(htmlPart.body.data);
  }

  // Fallback to plain text
  const textPart = findPartByMime(message.payload.parts, "text/plain");
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

/**
 * Mark an integration_connections row as error for a specific user+integration.
 * Used by cron mode to surface token failures in the UI.
 */
async function markIntegrationError(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  integrationId: string,
  errorMessage: string
) {
  await supabaseAdmin
    .from("integration_connections")
    .upsert({
      user_id: userId,
      integration_id: integrationId,
      status: "error",
      error_message: errorMessage,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,integration_id" });
}

/**
 * Mark integration_connections as connected with last_sync_at timestamp.
 */
async function markIntegrationSynced(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  integrationId: string
) {
  await supabaseAdmin
    .from("integration_connections")
    .upsert({
      user_id: userId,
      integration_id: integrationId,
      status: "connected",
      error_message: null,
      last_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,integration_id" });
}

/**
 * CRON MODE: Sync all users with active Gmail tokens.
 * Triggered when no valid user JWT is present (e.g. pg_cron with anon key).
 */
async function syncAllUsers(body: { action?: string }) {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const isRenewWatch = body.action === "renewWatch";

  // Get all users with Gmail tokens
  const { data: tokenRows, error: tokErr } = await supabaseAdmin
    .from("user_gmail_tokens")
    .select("user_id, gmail_email");

  if (tokErr || !tokenRows?.length) {
    console.log("CRON: No Gmail tokens found", tokErr?.message);
    return new Response(
      JSON.stringify({ cronMode: true, users_synced: 0, message: "No Gmail tokens found" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const results: Array<{ user_id: string; ok: boolean; messages?: number; error?: string }> = [];

  for (const row of tokenRows) {
    try {
      const accessToken = await getAccessTokenForUser(row.user_id, "cron");

      // Renew Gmail Watch (Pub/Sub push notifications)
      if (isRenewWatch) {
        try {
          const topicName = Deno.env.get("GMAIL_PUBSUB_TOPIC");
          if (topicName) {
            const watchRes = await fetch(
              "https://gmail.googleapis.com/gmail/v1/users/me/watch",
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  topicName,
                  labelIds: ["INBOX"],
                }),
              }
            );
            if (watchRes.ok) {
              console.log(`CRON: Gmail watch renewed for user ${row.user_id}`);
            } else {
              console.warn(`CRON: Gmail watch renewal failed for ${row.user_id}:`, await watchRes.text());
            }
          }
        } catch (e) {
          console.warn(`CRON: watch renewal error for ${row.user_id}:`, e);
        }
        results.push({ user_id: row.user_id, ok: true });
        continue;
      }

      // Get company_id
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("company_id")
        .eq("user_id", row.user_id)
        .maybeSingle();

      if (!profile?.company_id) {
        results.push({ user_id: row.user_id, ok: false, error: "no_company" });
        continue;
      }

      // Fetch last 1 day of emails
      const dateAfter = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);
      const listParams = new URLSearchParams({
        maxResults: "30",
        q: `after:${dateAfter}`,
      });

      const listResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?${listParams}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!listResponse.ok) {
        const errText = await listResponse.text();
        console.warn(`CRON: Gmail list failed for ${row.user_id}:`, errText);
        results.push({ user_id: row.user_id, ok: false, error: errText });
        continue;
      }

      const listData: ListMessagesResponse = await listResponse.json();
      let messagesUpserted = 0;

      if (listData.messages?.length) {
        for (const msgRef of listData.messages) {
          try {
            const msgResponse = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgRef.id}?format=full`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            if (!msgResponse.ok) continue;

            const msgData: GmailMessage = await msgResponse.json();
            const headers = msgData.payload.headers;
            const attachments = extractAttachments(msgData.payload);

            const msg = {
              id: msgData.id,
              threadId: msgData.threadId,
              from: getHeader(headers, "From"),
              to: getHeader(headers, "To"),
              subject: getHeader(headers, "Subject"),
              date: getHeader(headers, "Date"),
              snippet: decodeHtmlEntities(msgData.snippet || ""),
              body: sanitizeHtmlServerSide(getBodyContent(msgData)),
              internalDate: parseInt(msgData.internalDate),
              isUnread: msgData.labelIds?.includes("UNREAD") || false,
              attachments,
            };

            const { error: upsertError } = await supabaseAdmin
              .from("communications")
              .upsert({
                source: "gmail",
                source_id: msg.id,
                thread_id: msg.threadId,
                from_address: msg.from,
                to_address: msg.to,
                subject: msg.subject,
                body_preview: decodeHtmlEntities(
                  msg.body
                    ? msg.body.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300)
                    : (msg.snippet || "")
                ),
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
                user_id: row.user_id,
                company_id: profile.company_id,
              }, { onConflict: "source,source_id", ignoreDuplicates: false });

            if (!upsertError) {
              messagesUpserted++;
              await supabaseAdmin.from("activity_events").upsert({
                entity_type: "communication",
                entity_id: msg.id,
                event_type: "email_received",
                actor_id: row.user_id,
                actor_type: "system",
                description: `Email from ${msg.from}: ${msg.subject?.slice(0, 80) || "(no subject)"}`,
                company_id: profile.company_id,
                source: "gmail",
                dedupe_key: `gmail:${msg.id}`,
                metadata: { from: msg.from, to: msg.to, subject: msg.subject, threadId: msg.threadId },
              }, { onConflict: "dedupe_key", ignoreDuplicates: true });
            }
          } catch (msgErr) {
            console.warn(`CRON: failed to process message ${msgRef.id}:`, msgErr);
          }
        }
      }

      // Mark integration as synced successfully
      await markIntegrationSynced(supabaseAdmin, row.user_id, "gmail");
      results.push({ user_id: row.user_id, ok: true, messages: messagesUpserted });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown";
      console.warn(`CRON: Gmail sync failed for user ${row.user_id}:`, msg);

      // Self-healing: mark integration as error if token expired
      if (msg.includes("expired") || msg.includes("invalid_grant") || msg.includes("reconnect")) {
        await markIntegrationError(supabaseAdmin, row.user_id, "gmail", "Token expired — please reconnect");
      }

      results.push({ user_id: row.user_id, ok: false, error: msg });
    }
  }

  const synced = results.filter(r => r.ok).length;
  console.log(`CRON: Gmail sync complete. ${synced}/${results.length} users synced.`, JSON.stringify(results));

  return new Response(
    JSON.stringify({ cronMode: true, action: isRenewWatch ? "renewWatch" : "sync", users_synced: synced, total_users: results.length, results }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const clonedReq = req.clone();

    // Parse body early
    let body: { maxResults?: number; pageToken?: string; query?: string; action?: string } = {};
    try {
      body = await clonedReq.json();
    } catch {
      // No body
    }

    const userId = await verifyAuth(req);

    if (!userId) {
      // Check if cron call (anon/service key)
      const authHeader = req.headers.get("Authorization") || "";
      const token = authHeader.replace("Bearer ", "");
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

      if (token === anonKey || token === serviceKey) {
        console.log("CRON MODE: Syncing all Gmail users");
        return await syncAllUsers(body);
      }

      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the user's own Gmail access token with IP tracking
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const accessToken = await getAccessTokenForUser(userId, clientIp);

    // body already parsed above (before auth check)

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
          snippet: decodeHtmlEntities(msgData.snippet || ""),
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
          body_preview: decodeHtmlEntities(
            msg.body
              ? msg.body.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300)
              : (msg.snippet || "")
          ),
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
      } else {
        // Write activity_event for the ledger
        const { error: evtErr } = await supabaseAdmin
          .from("activity_events")
          .upsert({
            entity_type: "communication",
            entity_id: msg.id,
            event_type: "email_received",
            actor_id: userId,
            actor_type: "system",
            description: `Email from ${msg.from}: ${msg.subject?.slice(0, 80) || "(no subject)"}`,
            company_id: companyId,
            source: "gmail",
            dedupe_key: `gmail:${msg.id}`,
            metadata: { from: msg.from, to: msg.to, subject: msg.subject, threadId: msg.threadId },
          }, { onConflict: "dedupe_key", ignoreDuplicates: true });
        if (evtErr) console.error("Failed to write activity event:", evtErr);
      }
    }

    // Mark integration as synced for the single-user path too
    await markIntegrationSynced(supabaseAdmin, userId, "gmail");

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