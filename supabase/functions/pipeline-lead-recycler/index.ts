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
      .select("enabled, config")
      .eq("automation_key", "pipeline_lead_recycler")
      .maybeSingle();

    if (!config?.enabled) {
      return new Response(JSON.stringify({ skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const staleThresholdDays = (config.config as any)?.stale_days || 14;
    const lostThresholdDays = (config.config as any)?.lost_days || 30;
    const now = new Date();
    const staleDate = new Date(now.getTime() - staleThresholdDays * 86400000).toISOString();
    const lostDate = new Date(now.getTime() - lostThresholdDays * 86400000).toISOString();

    // Find leads stuck at quotation stages with no recent activity
    const quotationStages = ["quotation_bids", "quotation_priority"];

    let followedUp = 0;
    let markedLost = 0;

    for (const stage of quotationStages) {
      // Leads with no activity for 30+ days → mark lost
      const { data: lostLeads } = await supabase
        .from("leads")
        .select("id, company_name, company_id")
        .eq("stage", stage)
        .lt("updated_at", lostDate)
        .limit(50);

      for (const lead of lostLeads || []) {
        try {
          await supabase
            .from("leads")
            .update({
              stage: "lost",
              outcome: "lost",
              loss_reason: "no_response",
              updated_at: new Date().toISOString(),
            })
            .eq("id", lead.id);

          try {
            await supabase.from("activity_events").insert({
              company_id: lead.company_id,
              entity_type: "lead",
              entity_id: lead.id,
              event_type: "auto_lost",
              description: `Lead ${lead.company_name} auto-marked lost after ${lostThresholdDays} days of inactivity at ${stage}`,
              actor_type: "automation",
              source: "pipeline_lead_recycler",
              automation_source: "pipeline_lead_recycler",
            });
          } catch (_) {}

          markedLost++;
        } catch (_) {}
      }

      // Leads stale 14-30 days → log for follow-up
      const { data: staleLeads } = await supabase
        .from("leads")
        .select("id, company_name, company_id")
        .eq("stage", stage)
        .lt("updated_at", staleDate)
        .gte("updated_at", lostDate)
        .limit(50);

      for (const lead of staleLeads || []) {
        try {
          await supabase.from("activity_events").insert({
            company_id: lead.company_id,
            entity_type: "lead",
            entity_id: lead.id,
            event_type: "stale_followup_needed",
            description: `Lead ${lead.company_name} is stale at ${stage} — follow-up recommended`,
            actor_type: "automation",
            source: "pipeline_lead_recycler",
            automation_source: "pipeline_lead_recycler",
          });
          followedUp++;
        } catch (_) {}
      }
    }

    try {
      await supabase.from("automation_runs").insert({
        company_id: "a0000000-0000-0000-0000-000000000001",
        automation_key: "pipeline_lead_recycler",
        automation_name: "Dead Lead Recycler",
        agent_name: "Blitz",
        trigger_type: "cron",
        status: "completed",
        items_processed: followedUp + markedLost,
        items_succeeded: followedUp + markedLost,
        completed_at: new Date().toISOString(),
        metadata: { followed_up: followedUp, marked_lost: markedLost },
      });
    } catch (_) {}

    return new Response(JSON.stringify({ followed_up: followedUp, marked_lost: markedLost }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("pipeline-lead-recycler error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
