import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/auth.ts";
import { handleRequest } from "../_shared/requestHandler.ts";

/**
 * Vizzy Business Watchdog — runs every 15 minutes via pg_cron.
 * Scans all business domains for anomalies and writes alerts to notifications.
 * Uses metadata.dedupe_key to prevent duplicate alerts within 24 hours.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const alerts: Array<{ user_id: string; type: string; title: string; description: string; priority: string; dedupe: string; link_to?: string }> = [];

  // Get all admin users to notify
  const { data: adminRoles } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");
  const adminUserIds = (adminRoles || []).map((r: any) => r.user_id);

  if (adminUserIds.length === 0) {
    return new Response(JSON.stringify({ status: "no admins found" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Run all checks in parallel
    await Promise.all([
      checkUnansweredEmails(supabase, now, alerts, adminUserIds),
      checkStalledLeads(supabase, alerts, adminUserIds),
      checkAtRiskProduction(supabase, alerts, adminUserIds),
      checkMissedDeliveries(supabase, today, alerts, adminUserIds),
      checkOverdueInvoices(supabase, today, alerts, adminUserIds),
      checkLongShifts(supabase, now, alerts, adminUserIds),
      checkBrokenIntegrations(supabase, alerts, adminUserIds),
    ]);

    // Deduplicate: check existing notifications from last 24h with same dedupe keys
    const dedupeKeys = alerts.map((a) => a.dedupe);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    let existingKeys = new Set<string>();
    if (dedupeKeys.length > 0) {
      const { data: existing } = await supabase
        .from("notifications")
        .select("metadata")
        .gte("created_at", twentyFourHoursAgo)
        .eq("agent_name", "watchdog");
      existingKeys = new Set(
        (existing || [])
          .map((n: any) => n.metadata?.dedupe_key)
          .filter(Boolean)
      );
    }

    // Insert only new alerts
    const newAlerts = alerts.filter((a) => !existingKeys.has(a.dedupe));
    if (newAlerts.length > 0) {
      const rows = newAlerts.map((a) => ({
        user_id: a.user_id,
        type: a.type,
        title: a.title,
        description: a.description,
        priority: a.priority,
        agent_name: "watchdog",
        agent_color: "#ef4444",
        status: "unread",
        link_to: a.link_to || null,
        metadata: { dedupe_key: a.dedupe, source: "vizzy-business-watchdog" },
      }));
      await supabase.from("notifications").insert(rows);
    }

    console.log(`[watchdog] Scanned: ${alerts.length} anomalies found, ${newAlerts.length} new alerts created`);

    return new Response(
      JSON.stringify({ timestamp: now.toISOString(), total_anomalies: alerts.length, new_alerts: newAlerts.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[watchdog] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ─── CHECK FUNCTIONS ───

async function checkUnansweredEmails(
  supabase: any, now: Date, alerts: any[], adminUserIds: string[]
) {
  const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString();
  const { data: inbound } = await supabase
    .from("communications")
    .select("id, subject, from_address, received_at, thread_id")
    .eq("direction", "inbound")
    .eq("source", "gmail")
    .lt("received_at", fourHoursAgo)
    .gte("received_at", new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
    .limit(200);

  if (!inbound?.length) return;

  // Get outbound thread_ids in same period
  const threadIds = [...new Set((inbound as any[]).map((e) => e.thread_id).filter(Boolean))];
  if (threadIds.length === 0) return;

  const { data: replied } = await supabase
    .from("communications")
    .select("thread_id")
    .eq("direction", "outbound")
    .in("thread_id", threadIds.slice(0, 200));

  const repliedThreads = new Set((replied || []).map((r: any) => r.thread_id));
  const unanswered = (inbound as any[]).filter((e) => e.thread_id && !repliedThreads.has(e.thread_id));

  for (const email of unanswered.slice(0, 10)) {
    for (const uid of adminUserIds) {
      alerts.push({
        user_id: uid,
        type: "warning",
        title: `Unanswered email from ${email.from_address?.split("@")[0] || "unknown"}`,
        description: `"${email.subject || "No subject"}" received ${timeSince(new Date(email.received_at))} ago — no reply sent.`,
        priority: "medium",
        dedupe: `unanswered-email-${email.id}`,
      });
    }
  }
}

async function checkStalledLeads(supabase: any, alerts: any[], adminUserIds: string[]) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: stalled } = await supabase
    .from("leads")
    .select("id, title, stage, updated_at, expected_value")
    .in("stage", ["new", "contacted", "qualified", "proposal", "negotiation"])
    .lt("updated_at", sevenDaysAgo)
    .limit(20);

  for (const lead of stalled || []) {
    for (const uid of adminUserIds) {
      alerts.push({
        user_id: uid,
        type: "warning",
        title: `Stalled lead: ${lead.title}`,
        description: `Stage "${lead.stage}" unchanged for ${timeSince(new Date(lead.updated_at))}. Value: $${lead.expected_value || 0}`,
        priority: lead.expected_value > 10000 ? "high" : "medium",
        dedupe: `stalled-lead-${lead.id}`,
        link_to: `/crm?lead=${lead.id}`,
      });
    }
  }
}

async function checkAtRiskProduction(supabase: any, alerts: any[], adminUserIds: string[]) {
  const fiveDaysFromNow = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const { data: items } = await supabase
    .from("cut_plan_items")
    .select("id, bar_code, total_pieces, completed_pieces, phase")
    .in("phase", ["queued", "cutting", "bending"])
    .limit(200);

  for (const item of items || []) {
    const progress = item.total_pieces > 0 ? (item.completed_pieces || 0) / item.total_pieces : 0;
    if (progress < 0.5) {
      for (const uid of adminUserIds) {
        alerts.push({
          user_id: uid,
          type: "alert",
          title: `At-risk production: ${item.bar_code || item.id.slice(0, 8)}`,
          description: `Only ${Math.round(progress * 100)}% complete (${item.completed_pieces || 0}/${item.total_pieces} pieces). Phase: ${item.phase}`,
          priority: progress < 0.2 ? "high" : "medium",
          dedupe: `atrisk-prod-${item.id}`,
          link_to: "/production",
        });
      }
    }
  }
}

async function checkMissedDeliveries(supabase: any, today: string, alerts: any[], adminUserIds: string[]) {
  const { data: deliveries } = await supabase
    .from("deliveries")
    .select("id, delivery_number, status, scheduled_date")
    .eq("scheduled_date", today)
    .not("status", "in", '("in_transit","delivered","completed")')
    .limit(20);

  for (const d of deliveries || []) {
    for (const uid of adminUserIds) {
      alerts.push({
        user_id: uid,
        type: "warning",
        title: `Delivery not dispatched: ${d.delivery_number || d.id.slice(0, 8)}`,
        description: `Scheduled for today but status is "${d.status}".`,
        priority: "high",
        dedupe: `missed-delivery-${d.id}-${today}`,
        link_to: "/deliveries",
      });
    }
  }
}

async function checkOverdueInvoices(supabase: any, today: string, alerts: any[], adminUserIds: string[]) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const { data: invoices } = await supabase
    .from("accounting_mirror")
    .select("id, balance, data, quickbooks_id")
    .eq("entity_type", "Invoice")
    .gt("balance", 0)
    .limit(200);

  const overdue = (invoices || []).filter((inv: any) => {
    const dueDate = inv.data?.DueDate;
    return dueDate && dueDate < thirtyDaysAgo;
  });

  for (const inv of overdue.slice(0, 10)) {
    const customerName = inv.data?.CustomerRef?.name || inv.data?.CustomerRef?.Name || "Unknown";
    for (const uid of adminUserIds) {
      alerts.push({
        user_id: uid,
        type: "alert",
        title: `Overdue invoice: ${customerName}`,
        description: `$${inv.balance} overdue since ${inv.data?.DueDate}. QB#${inv.quickbooks_id}`,
        priority: inv.balance > 5000 ? "high" : "medium",
        dedupe: `overdue-inv-${inv.id}`,
        link_to: "/accounting",
      });
    }
  }
}

async function checkLongShifts(supabase: any, now: Date, alerts: any[], adminUserIds: string[]) {
  const tenHoursAgo = new Date(now.getTime() - 10 * 60 * 60 * 1000).toISOString();
  const { data: entries } = await supabase
    .from("time_entries")
    .select("id, user_id, clock_in, clock_out")
    .is("clock_out", null)
    .lt("clock_in", tenHoursAgo)
    .limit(20);

  if (!entries?.length) return;

  const userIds = [...new Set((entries as any[]).map((e) => e.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, full_name")
    .in("user_id", userIds);
  const nameMap = new Map((profiles || []).map((p: any) => [p.user_id, p.full_name]));

  for (const entry of entries) {
    const name = nameMap.get(entry.user_id) || "Unknown";
    for (const uid of adminUserIds) {
      alerts.push({
        user_id: uid,
        type: "warning",
        title: `Long shift: ${name}`,
        description: `Clocked in ${timeSince(new Date(entry.clock_in))} ago without clock-out.`,
        priority: "medium",
        dedupe: `long-shift-${entry.id}`,
        link_to: "/hr",
      });
    }
  }
}

async function checkBrokenIntegrations(supabase: any, alerts: any[], adminUserIds: string[]) {
  const { data: broken } = await supabase
    .from("integration_connections")
    .select("id, provider, status, user_id")
    .eq("status", "error")
    .limit(20);

  for (const conn of broken || []) {
    for (const uid of adminUserIds) {
      alerts.push({
        user_id: uid,
        type: "alert",
        title: `Integration down: ${conn.provider}`,
        description: `${conn.provider} connection has an error. Needs reconnection.`,
        priority: "high",
        dedupe: `broken-int-${conn.id}`,
        link_to: "/settings/integrations",
      });
    }
  }
}

// ─── HELPERS ───

function timeSince(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}
