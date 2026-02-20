import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { data: config } = await supabase
      .from("automation_configs")
      .select("enabled")
      .eq("automation_key", "quote_expiry_watchdog")
      .maybeSingle();

    if (!config?.enabled) {
      return new Response(JSON.stringify({ skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const sevenDays = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10);
    const today = now.toISOString().slice(0, 10);

    // Find quotes expiring in next 7 days
    const { data: expiringQuotes } = await supabase
      .from("quotes")
      .select("id, quote_number, lead_id, customer_id, total_amount, valid_until, company_id")
      .lte("valid_until", sevenDays)
      .gte("valid_until", today)
      .eq("status", "sent")
      .limit(100);

    let alerts = 0;

    for (const q of expiringQuotes || []) {
      try {
        await supabase.from("activity_events").insert({
          company_id: q.company_id,
          entity_type: "quote",
          entity_id: q.id,
          event_type: "quote_expiring_soon",
          description: `Quote ${q.quote_number} ($${q.total_amount}) expires on ${q.valid_until}`,
          actor_type: "automation",
          source: "quote_expiry_watchdog",
          automation_source: "quote_expiry_watchdog",
        });
        alerts++;
      } catch (_) {}
    }

    // Find already expired quotes (past 14 days)
    const fourteenAgo = new Date(now.getTime() - 14 * 86400000).toISOString().slice(0, 10);
    const { data: expiredQuotes } = await supabase
      .from("quotes")
      .select("id, quote_number, lead_id, company_id")
      .lt("valid_until", today)
      .gte("valid_until", fourteenAgo)
      .eq("status", "sent")
      .limit(50);

    let expired = 0;
    for (const q of expiredQuotes || []) {
      if (!q.lead_id) continue;
      try {
        await supabase.from("activity_events").insert({
          company_id: q.company_id,
          entity_type: "quote",
          entity_id: q.id,
          event_type: "quote_expired",
          description: `Quote ${q.quote_number} has expired — lead may need re-engagement`,
          actor_type: "automation",
          source: "quote_expiry_watchdog",
          automation_source: "quote_expiry_watchdog",
        });
        expired++;
      } catch (_) {}
    }

    try {
      await supabase.from("automation_runs").insert({
        company_id: "a0000000-0000-0000-0000-000000000001",
        automation_key: "quote_expiry_watchdog",
        automation_name: "Quote Expiry Watchdog",
        agent_name: "Gauge",
        trigger_type: "cron",
        status: "completed",
        items_processed: alerts + expired,
        items_succeeded: alerts + expired,
        completed_at: new Date().toISOString(),
        metadata: { expiring_soon: alerts, already_expired: expired },
      });
    } catch (_) {}

    return new Response(JSON.stringify({ expiring_soon: alerts, already_expired: expired }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("quote-expiry-watchdog error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
