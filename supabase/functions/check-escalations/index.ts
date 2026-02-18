import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // 1. Find pending escalations that are due
    const { data: pending, error: fetchErr } = await supabase
      .from("alert_escalation_queue")
      .select("*, alert_routing_rules(*)")
      .eq("status", "pending")
      .lte("escalate_at", new Date().toISOString())
      .limit(50);

    if (fetchErr) throw fetchErr;
    if (!pending || pending.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, escalated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let escalatedCount = 0;

    for (const entry of pending) {
      // 2. Check if the original notification was acknowledged
      const { data: notif } = await supabase
        .from("notifications")
        .select("status")
        .eq("id", entry.notification_id)
        .single();

      if (notif && (notif.status === "read" || notif.status === "actioned")) {
        // Already acknowledged — mark queue entry as acknowledged
        await supabase
          .from("alert_escalation_queue")
          .update({
            status: "acknowledged",
            acknowledged_at: new Date().toISOString(),
          })
          .eq("id", entry.id);
        continue;
      }

      const rule = entry.alert_routing_rules;
      if (!rule) {
        await supabase
          .from("alert_escalation_queue")
          .update({ status: "expired" })
          .eq("id", entry.id);
        continue;
      }

      // 3. Determine escalation target
      const nextLevel = entry.escalation_level + 1;
      let escalateToRole: string | null = null;

      if (nextLevel === 1 && rule.escalate_to_role) {
        escalateToRole = rule.escalate_to_role;
      } else if (nextLevel >= 2) {
        // Escalate to CEO / admin
        escalateToRole = "admin";
      }

      if (!escalateToRole) {
        await supabase
          .from("alert_escalation_queue")
          .update({ status: "expired" })
          .eq("id", entry.id);
        continue;
      }

      // 4. Find users in the escalation role for this company
      const { data: roleUsers } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", escalateToRole);

      const escalationUserIds = [...new Set((roleUsers || []).map((u: any) => u.user_id))];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, email, phone_number, full_name")
        .eq("company_id", entry.company_id)
        .in("user_id", escalationUserIds);

      const escalationUsers = profiles || [];

      // 5. Re-dispatch to escalation targets (in-app only for escalations)
      for (const user of escalationUsers) {
        const escalationTitle = `⚠️ ESCALATION (Level ${nextLevel}): ${notif ? "" : ""}`;
        const { data: origNotif } = await supabase
          .from("notifications")
          .select("title, description, link_to, metadata, agent_name")
          .eq("id", entry.notification_id)
          .single();

        const { data: newNotif } = await supabase
          .from("notifications")
          .insert({
            user_id: user.user_id,
            type: "notification",
            title: `⚠️ ESCALATED: ${origNotif?.title || "Alert"}`,
            description: `Escalation Level ${nextLevel} — Original alert was not acknowledged.\n${origNotif?.description || ""}`,
            link_to: origNotif?.link_to,
            priority: "high",
            agent_name: origNotif?.agent_name || "System",
            status: "unread",
            metadata: {
              ...(origNotif?.metadata as Record<string, unknown> || {}),
              escalation_level: nextLevel,
              original_notification_id: entry.notification_id,
            },
          })
          .select("id")
          .single();

        // Log escalation dispatch
        await supabase.from("alert_dispatch_log").insert({
          company_id: entry.company_id,
          notification_id: newNotif?.id,
          channel: "in_app",
          recipient_user_id: user.user_id,
          recipient_address: user.email || user.user_id,
          status: "delivered",
          metadata: {
            escalation_level: nextLevel,
            original_notification_id: entry.notification_id,
          },
        });
      }

      // 6. Update queue entry
      const nextEscalateMinutes = rule.escalate_to_ceo_after_minutes || rule.escalate_after_minutes || 60;
      const nextEscalateAt = new Date(Date.now() + nextEscalateMinutes * 60000);

      if (nextLevel >= 2) {
        // Max escalation reached
        await supabase
          .from("alert_escalation_queue")
          .update({
            status: "escalated",
            escalation_level: nextLevel,
          })
          .eq("id", entry.id);
      } else {
        // Set up next escalation level
        await supabase
          .from("alert_escalation_queue")
          .update({
            escalation_level: nextLevel,
            escalate_at: nextEscalateAt.toISOString(),
            status: "pending",
          })
          .eq("id", entry.id);
      }

      escalatedCount++;
    }

    return new Response(
      JSON.stringify({ ok: true, checked: pending.length, escalated: escalatedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("check-escalations error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
