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
    // Check if automation is enabled
    const { data: config } = await supabase
      .from("automation_configs")
      .select("enabled, config")
      .eq("automation_key", "auto_approve_penny")
      .maybeSingle();

    if (!config?.enabled) {
      return new Response(JSON.stringify({ skipped: true, reason: "automation disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const threshold = (config.config as any)?.amount_threshold || 5000;
    const minDaysOverdue = (config.config as any)?.min_days_overdue || 30;

    // Find pending items that qualify
    const { data: items, error } = await supabase
      .from("penny_collection_queue")
      .select("*")
      .eq("status", "pending_approval")
      .lt("amount", threshold)
      .gte("days_overdue", minDaysOverdue);

    if (error) throw error;

    let approved = 0;
    let failed = 0;

    for (const item of items || []) {
      try {
        const { error: upErr } = await supabase
          .from("penny_collection_queue")
          .update({
            status: "approved",
            approved_at: new Date().toISOString(),
            approved_by: null, // auto-approved
          })
          .eq("id", item.id);

        if (upErr) throw upErr;

        // Trigger execution
        try {
          await supabase.functions.invoke("penny-execute-action", { body: { action_id: item.id } });
        } catch (_) { /* best effort */ }

        // Log activity
        try {
          await supabase.from("activity_events").insert({
            company_id: item.company_id,
            entity_type: "penny_collection_queue",
            entity_id: item.id,
            event_type: "auto_approved",
            description: `Auto-approved collection action for ${item.customer_name} ($${item.amount})`,
            actor_type: "automation",
            source: "auto_approve_penny",
            automation_source: "auto_approve_penny",
          });
        } catch (_) {}

        approved++;
      } catch (_) {
        failed++;
      }
    }

    // Log run
    try {
      await supabase.from("automation_runs").insert({
        company_id: "a0000000-0000-0000-0000-000000000001",
        automation_key: "auto_approve_penny",
        automation_name: "Auto-Approve Collections <$5K",
        agent_name: "Penny",
        trigger_type: "cron",
        status: failed > 0 ? "partial" : "completed",
        items_processed: (items || []).length,
        items_succeeded: approved,
        items_failed: failed,
        completed_at: new Date().toISOString(),
      });
    } catch (_) {}

    // Update config stats
    try {
      await supabase.from("automation_configs")
        .update({
          last_run_at: new Date().toISOString(),
          total_runs: (config as any).total_runs + 1,
          total_success: (config as any).total_success + approved,
          total_failed: (config as any).total_failed + failed,
        })
        .eq("automation_key", "auto_approve_penny");
    } catch (_) {}

    return new Response(JSON.stringify({ approved, failed, total: (items || []).length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("auto-approve-penny error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
