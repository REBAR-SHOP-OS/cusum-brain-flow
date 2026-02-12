import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decryptToken } from "../_shared/tokenEncryption.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CommsConfig {
  external_sender: string;
  internal_sender: string;
  internal_domain: string;
  response_thresholds_hours: number[];
  missed_call_alert: string;
  ceo_email: string;
  brief_recipients: string[];
  no_act_global: boolean;
}

// ── Layer 1: Skip-sender patterns (no-reply, marketing, system senders) ──
const SKIP_SENDERS: string[] = [
  "noreply@", "no-reply@", "mailer-daemon@", "postmaster@",
  "@accounts.google.com", "@google.com",
  "@stripe.com", "@linkedin.com", "@facebookmail.com",
  "@instagram.com", "@twitter.com", "@x.com",
  "@newsletter.", "@marketing.", "@notify.", "@notifications.",
  "@synologynotification.com", "@ringcentral.com",
  "@amazonses.com", "@amazon.com", "@amazon.ca",
  "@quickbooks.intuit.com", "@intuit.com",
  "@github.com", "@gitlab.com",
  "@openai.com", "@anthropic.com",
  "@zoom.us", "@calendly.com",
  "@slack.com", "@atlassian.com",
  "@hubspot.com", "@mailchimp.com", "@sendgrid.net",
  "@canva.com", "@figma.com", "@notion.so",
  "@godaddy.com", "@namecheap.com",
  "updates@", "info@", "support@", "billing@", "team@",
  "notification@", "notifications@", "alert@", "alerts@",
  "digest@", "news@", "promo@", "promotions@",
  "donotreply@", "do-not-reply@", "bounce@",
];

// ── Layer 4: Subject-based spam / system detection ──
const SKIP_SUBJECT_PATTERNS: RegExp[] = [
  /% off/i, /\bdeal(s)?\b/i, /\bcheap\b/i, /\bdiscount\b/i,
  /unsubscribe/i, /\bopt.out\b/i,
  /\[CMS\]/i, /\[Task Update\]/i, /Daily Report/i, /Daily Brief/i,
  /\bnewsletter\b/i, /\bwebinar\b/i,
  /pick up where you left off/i,
  /unread messages?$/i,
  /Your messages\. Your Gmail/i,
  /\bflight\b.*\bdeal/i,
  /\bSynology\b/i,
];

// Bot / system recipient addresses that should never receive alerts about themselves
const BOT_RECIPIENTS = ["ai@rebar.shop"];

/**
 * Determines whether an alert should be skipped for a given communication.
 * Returns a reason string if skipped, or null if the alert should proceed.
 */
function shouldSkipAlert(
  comm: { from_address?: string; to_address?: string; subject?: string },
  internalDomain: string,
): string | null {
  const from = (comm.from_address || "").toLowerCase();
  const to = (comm.to_address || "").toLowerCase();
  const subject = comm.subject || "";

  // Layer 1: Known spam / system senders
  for (const pattern of SKIP_SENDERS) {
    if (from.includes(pattern)) return `skip_sender:${pattern}`;
  }

  // Layer 2: Internal emails (same domain)
  if (internalDomain && from.includes(`@${internalDomain.replace(/^@/, "").toLowerCase()}`)) {
    return "internal_sender";
  }

  // Bot recipients — don't alert about emails TO the bot
  for (const bot of BOT_RECIPIENTS) {
    if (to.includes(bot)) return `bot_recipient:${bot}`;
  }

  // Layer 4: Subject-based spam detection
  for (const rx of SKIP_SUBJECT_PATTERNS) {
    if (rx.test(subject)) return `skip_subject:${rx.source}`;
  }

  return null;
}

// ── Layer 3 helper: pick only the highest breached threshold ──
function highestBreachedThreshold(
  receivedAt: string,
  thresholds: number[],
  now: Date,
): number | null {
  const age = (now.getTime() - new Date(receivedAt).getTime()) / 3_600_000; // hours
  const sorted = [...thresholds].sort((a, b) => b - a); // descending
  for (const t of sorted) {
    if (age >= t) return t;
  }
  return null;
}

// ── Gmail helpers (unchanged) ──

async function getInternalSenderToken(svc: ReturnType<typeof createClient>): Promise<string> {
  const { data: profile } = await svc
    .from("profiles")
    .select("user_id")
    .eq("email", "ai@rebar.shop")
    .maybeSingle();

  if (!profile?.user_id) throw new Error("ai@rebar.shop profile not found");

  const { data: tokenRow } = await svc
    .from("user_gmail_tokens")
    .select("refresh_token, is_encrypted")
    .eq("user_id", profile.user_id)
    .maybeSingle();

  let refreshToken = tokenRow?.refresh_token;
  if (refreshToken && tokenRow?.is_encrypted) {
    refreshToken = await decryptToken(refreshToken);
  }
  if (!refreshToken) {
    const shared = Deno.env.get("GMAIL_REFRESH_TOKEN");
    if (shared) refreshToken = shared;
  }
  if (!refreshToken) throw new Error("No Gmail token for ai@rebar.shop");

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GMAIL_CLIENT_ID")!,
      client_secret: Deno.env.get("GMAIL_CLIENT_SECRET")!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!resp.ok) throw new Error(`Token refresh failed: ${await resp.text()}`);
  const data = await resp.json();

  if (data.refresh_token) {
    const { encryptToken } = await import("../_shared/tokenEncryption.ts");
    const enc = await encryptToken(data.refresh_token);
    await svc
      .from("user_gmail_tokens")
      .update({ refresh_token: enc, is_encrypted: true, token_rotated_at: new Date().toISOString() })
      .eq("user_id", profile.user_id);
  }

  return data.access_token;
}

function createRawEmail(to: string, subject: string, body: string, fromEmail: string): string {
  const lines = [
    `From: ${fromEmail}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=utf-8",
    "",
    body,
  ];
  const raw = lines.join("\r\n");
  const b64 = btoa(unescape(encodeURIComponent(raw)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sendAlertEmail(accessToken: string, to: string, subject: string, htmlBody: string) {
  const raw = createRawEmail(to, subject, htmlBody, "ai@rebar.shop");
  const resp = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });
  if (!resp.ok) {
    console.error(`Alert email to ${to} failed:`, await resp.text());
    return false;
  }
  await resp.json();
  return true;
}

function buildAlertHTML(alertType: string, ownerEmail: string, comm: any, agentName: string): string {
  const isMissedCall = alertType === "missed_call";
  const icon = isMissedCall ? "📞" : "⏰";
  const title = isMissedCall
    ? `Missed Call from ${comm.from_address || "Unknown"}`
    : `Unanswered Email — ${alertType.replace("response_time_", "")} breach`;

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:560px;margin:20px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <div style="background:#dc2626;padding:16px 24px;color:#fff;">
    <h2 style="margin:0;font-size:16px;">${icon} ${title}</h2>
  </div>
  <div style="padding:20px 24px;font-size:14px;color:#333;line-height:1.6;">
    <p><strong>Owner:</strong> ${ownerEmail} (AI Shadow: ${agentName})</p>
    <p><strong>From:</strong> ${comm.from_address || "N/A"}</p>
    <p><strong>Subject:</strong> ${comm.subject || "(no subject)"}</p>
    <p><strong>Received:</strong> ${comm.received_at || "N/A"}</p>
    <p><strong>Preview:</strong> ${(comm.body_preview || "").slice(0, 200)}</p>
  </div>
  <div style="padding:12px 24px;background:#f8f9fa;font-size:11px;color:#888;text-align:center;">
    Rebar.shop Comms Engine — Automated Alert
  </div>
</div></body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Load config
    const { data: configRow } = await svc
      .from("comms_config")
      .select("*")
      .eq("company_id", "a0000000-0000-0000-0000-000000000001")
      .maybeSingle();

    if (!configRow) {
      return new Response(JSON.stringify({ error: "No comms_config found" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const config: CommsConfig = {
      external_sender: configRow.external_sender,
      internal_sender: configRow.internal_sender,
      internal_domain: configRow.internal_domain,
      response_thresholds_hours: configRow.response_thresholds_hours as number[],
      missed_call_alert: configRow.missed_call_alert,
      ceo_email: configRow.ceo_email,
      brief_recipients: configRow.brief_recipients,
      no_act_global: configRow.no_act_global,
    };

    // Load pairings for owner lookup
    const { data: pairings } = await svc.from("comms_agent_pairing").select("*");
    const pairingMap = new Map((pairings || []).map((p: any) => [p.user_email, p]));

    const now = new Date();
    const alerts: { type: string; commId: string; owner: string; agent: string; comm: any }[] = [];
    let skippedCount = 0;

    // --- Response-time alerts (with Layer 1-4 filtering + Layer 3 escalation) ---

    // Gather ALL unanswered inbound emails from last 48h
    const oldestWindow = new Date(now.getTime() - 48 * 3600 * 1000);
    const { data: unanswered } = await svc
      .from("communications")
      .select("id, from_address, to_address, subject, body_preview, received_at, thread_id")
      .eq("direction", "inbound")
      .eq("source", "gmail")
      .gte("received_at", oldestWindow.toISOString())
      .limit(200);

    for (const comm of unanswered || []) {
      // ── Layers 1/2/4: Should we skip this comm entirely? ──
      const skipReason = shouldSkipAlert(comm, config.internal_domain);
      if (skipReason) {
        skippedCount++;
        continue;
      }

      // ── Layer 3: Only fire the HIGHEST breached threshold ──
      const highestThreshold = highestBreachedThreshold(
        comm.received_at,
        config.response_thresholds_hours,
        now,
      );
      if (!highestThreshold) continue; // not old enough for any threshold

      const alertType = `response_time_${highestThreshold}h`;

      // Check if a reply exists in the thread
      if (comm.thread_id) {
        const { count } = await svc
          .from("communications")
          .select("id", { count: "exact", head: true })
          .eq("thread_id", comm.thread_id)
          .eq("direction", "outbound")
          .gt("received_at", comm.received_at);
        if (count && count > 0) continue; // replied
      }

      // Check if THIS specific alert already exists (dedup)
      const { count: alertExists } = await svc
        .from("comms_alerts")
        .select("id", { count: "exact", head: true })
        .eq("communication_id", comm.id)
        .eq("alert_type", alertType);
      if (alertExists && alertExists > 0) continue;

      // Find owner from to_address
      const ownerEmail = comm.to_address?.toLowerCase() || "";
      const pairing = pairingMap.get(ownerEmail);

      alerts.push({
        type: alertType,
        commId: comm.id,
        owner: ownerEmail,
        agent: (pairing as any)?.agent_name || "Vizzy",
        comm,
      });
    }

    // --- Missed call alerts ---
    const { data: missedCalls } = await svc
      .from("communications")
      .select("id, from_address, to_address, subject, body_preview, received_at, metadata")
      .eq("source", "ringcentral")
      .gte("received_at", new Date(now.getTime() - 24 * 3600 * 1000).toISOString())
      .limit(50);

    for (const comm of missedCalls || []) {
      const meta = comm.metadata as any;
      if (meta?.result !== "Missed" && meta?.type !== "missed") continue;

      const { count: alertExists } = await svc
        .from("comms_alerts")
        .select("id", { count: "exact", head: true })
        .eq("communication_id", comm.id)
        .eq("alert_type", "missed_call");
      if (alertExists && alertExists > 0) continue;

      // Map RC extension to owner
      let ownerEmail = comm.to_address || "";
      if (meta?.extension) {
        const extPairing = (pairings || []).find((p: any) => p.rc_extension === meta.extension);
        if (extPairing) ownerEmail = (extPairing as any).user_email;
      }

      alerts.push({
        type: "missed_call",
        commId: comm.id,
        owner: ownerEmail,
        agent: (pairingMap.get(ownerEmail) as any)?.agent_name || "Vizzy",
        comm,
      });
    }

    // --- Send alerts ---
    let accessToken: string | null = null;
    const results: { type: string; owner: string; sent: boolean }[] = [];

    for (const alert of alerts) {
      // Insert alert record
      await svc.from("comms_alerts").insert({
        alert_type: alert.type,
        communication_id: alert.commId,
        owner_email: alert.owner,
        company_id: "a0000000-0000-0000-0000-000000000001",
        metadata: { agent_name: alert.agent, subject: alert.comm.subject },
      });

      // Send email notifications
      try {
        if (!accessToken) accessToken = await getInternalSenderToken(svc);

        const html = buildAlertHTML(alert.type, alert.owner, alert.comm, alert.agent);
        const subj = alert.type === "missed_call"
          ? `[Alert] Missed call from ${alert.comm.from_address || "Unknown"}`
          : `[Alert] Unanswered email — ${alert.type.replace("response_time_", "")} — ${alert.comm.subject || ""}`;

        // Send to owner
        if (alert.owner) {
          const ownerOk = await sendAlertEmail(accessToken, alert.owner, subj, html);
          if (ownerOk) {
            await svc.from("comms_alerts")
              .update({ owner_notified_at: new Date().toISOString() })
              .eq("communication_id", alert.commId)
              .eq("alert_type", alert.type);
          }
        }

        // Send to CEO
        const ceoOk = await sendAlertEmail(accessToken, config.ceo_email, subj, html);
        if (ceoOk) {
          await svc.from("comms_alerts")
            .update({ ceo_notified_at: new Date().toISOString() })
            .eq("communication_id", alert.commId)
            .eq("alert_type", alert.type);
        }

        results.push({ type: alert.type, owner: alert.owner, sent: true });
      } catch (e) {
        console.error(`Alert send failed for ${alert.owner}:`, e);
        results.push({ type: alert.type, owner: alert.owner, sent: false });
      }
    }

    // Log event
    if (alerts.length > 0 || skippedCount > 0) {
      await svc.from("activity_events").insert({
        company_id: "a0000000-0000-0000-0000-000000000001",
        entity_type: "comms_alert",
        entity_id: "system",
        event_type: "alerts_processed",
        description: `Processed ${alerts.length} alerts (${skippedCount} skipped by smart filter): ${results.filter(r => r.sent).length} sent`,
        metadata: { alerts_count: alerts.length, skipped_count: skippedCount, results },
        source: "system",
      });
    }

    return new Response(
      JSON.stringify({ success: true, alertsProcessed: alerts.length, skipped: skippedCount, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("comms-alerts error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
