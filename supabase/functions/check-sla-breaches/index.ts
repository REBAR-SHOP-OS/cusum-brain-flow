import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate: accept service_role key only (cron / manual admin trigger)
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    // Allow service role or check user is admin
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (token !== serviceRoleKey) {
      // Verify the caller is an admin
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Admin required" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const now = new Date();
    let breachCount = 0;

    // ── 1. Lead SLA breaches ──
    const { data: breachedLeads } = await supabase
      .from("leads")
      .select("id, stage, sla_deadline, company_id, title")
      .lt("sla_deadline", now.toISOString())
      .eq("sla_breached", false)
      .not("sla_deadline", "is", null)
      .not("stage", "in", "(won,lost,archived_orphan)");

    const SLA_ESCALATION_MAP: Record<string, { hours: number; target: string }> = {
      new: { hours: 24, target: "Sales Mgr" },
      hot_enquiries: { hours: 24, target: "Sales Mgr" },
      telephonic_enquiries: { hours: 24, target: "Sales Mgr" },
      qualified: { hours: 24, target: "Sales Mgr" },
      estimation_ben: { hours: 48, target: "Sales Mgr" },
      estimation_karthick: { hours: 48, target: "Sales Mgr" },
      qc_ben: { hours: 24, target: "Ops Mgr" },
      shop_drawing: { hours: 72, target: "Ops Mgr" },
      shop_drawing_approval: { hours: 120, target: "Sales Mgr" },
      quotation_priority: { hours: 48, target: "Sales Mgr" },
      quotation_bids: { hours: 48, target: "Sales Mgr" },
      rfi: { hours: 48, target: "Sales Mgr" },
      addendums: { hours: 48, target: "Sales Mgr" },
    };

    if (breachedLeads && breachedLeads.length > 0) {
      for (const lead of breachedLeads) {
        const slaInfo = SLA_ESCALATION_MAP[lead.stage] || { hours: 24, target: "Ops Mgr" };

        // Mark breached
        await supabase
          .from("leads")
          .update({ sla_breached: true, escalated_to: slaInfo.target })
          .eq("id", lead.id);

        // Log to escalation table
        await supabase.from("sla_escalation_log").insert({
          entity_type: "lead",
          entity_id: lead.id,
          stage: lead.stage,
          sla_hours: slaInfo.hours,
          escalated_to: slaInfo.target,
          company_id: lead.company_id,
        });

        // Create human_task
        const dedupeKey = `sla:lead:${lead.id}:${lead.stage}`;
        await supabase.from("human_tasks").upsert(
          {
            company_id: lead.company_id,
            dedupe_key: dedupeKey,
            title: `SLA Breach: ${lead.title || "Lead"} stuck in ${lead.stage.replace(/_/g, " ")}`,
            description: `This lead exceeded the ${slaInfo.hours}h SLA for stage "${lead.stage.replace(/_/g, " ")}". Escalated to ${slaInfo.target}.`,
            severity: "critical",
            category: "sla_breach",
            entity_type: "lead",
            entity_id: lead.id,
            status: "open",
            reason: `SLA deadline was ${lead.sla_deadline}. Current time: ${now.toISOString()}.`,
            impact: `Pipeline velocity blocked — lead stalled.`,
          },
          { onConflict: "dedupe_key", ignoreDuplicates: true }
        );

        breachCount++;
      }
    }

    // ── 2. Order-level breaches ──
    // Production blocked > 12h
    const twelveHoursAgo = new Date(now.getTime() - 12 * 3600000).toISOString();
    const { data: blockedOrders } = await supabase
      .from("orders")
      .select("id, order_number, company_id, production_locked, updated_at")
      .eq("production_locked", true)
      .in("status", ["confirmed", "in_production"])
      .lt("updated_at", twelveHoursAgo);

    if (blockedOrders) {
      for (const order of blockedOrders) {
        if (!order.company_id) continue;
        const dedupeKey = `sla:order_blocked:${order.id}`;

        await supabase.from("sla_escalation_log").insert({
          entity_type: "order",
          entity_id: order.id,
          stage: "production_blocked",
          sla_hours: 12,
          escalated_to: "Ops Mgr",
          company_id: order.company_id,
        });

        await supabase.from("human_tasks").upsert(
          {
            company_id: order.company_id,
            dedupe_key: dedupeKey,
            title: `Production Blocked > 12h: ${order.order_number}`,
            description: `Order ${order.order_number} has been production-locked for over 12 hours. Escalated to Ops Mgr.`,
            severity: "critical",
            category: "sla_breach",
            entity_type: "order",
            entity_id: order.id,
            status: "open",
          },
          { onConflict: "dedupe_key", ignoreDuplicates: true }
        );
        breachCount++;
      }
    }

    // QC evidence pending > 4h
    const fourHoursAgo = new Date(now.getTime() - 4 * 3600000).toISOString();
    const { data: qcPendingOrders } = await supabase
      .from("orders")
      .select("id, order_number, company_id, updated_at")
      .eq("qc_evidence_uploaded", false)
      .eq("status", "in_production")
      .lt("updated_at", fourHoursAgo);

    if (qcPendingOrders) {
      for (const order of qcPendingOrders) {
        if (!order.company_id) continue;
        const dedupeKey = `sla:qc_pending:${order.id}`;

        await supabase.from("sla_escalation_log").insert({
          entity_type: "order",
          entity_id: order.id,
          stage: "qc_evidence_pending",
          sla_hours: 4,
          escalated_to: "Ops Mgr",
          company_id: order.company_id,
        });

        await supabase.from("human_tasks").upsert(
          {
            company_id: order.company_id,
            dedupe_key: dedupeKey,
            title: `QC Evidence Missing > 4h: ${order.order_number}`,
            description: `Order ${order.order_number} needs QC evidence uploaded. Blocking delivery. Escalated to Ops Mgr.`,
            severity: "warning",
            category: "sla_breach",
            entity_type: "order",
            entity_id: order.id,
            status: "open",
          },
          { onConflict: "dedupe_key", ignoreDuplicates: true }
        );
        breachCount++;
      }
    }

    // ── 3. Revision offenders (>1 revision — immediate escalation) ──
    const { data: revisionOrders } = await supabase
      .from("orders")
      .select("id, order_number, company_id, customer_revision_count")
      .gt("customer_revision_count", 1)
      .eq("billable_revision_required", true)
      .eq("pending_change_order", true);

    if (revisionOrders) {
      for (const order of revisionOrders) {
        if (!order.company_id) continue;
        const dedupeKey = `sla:revision:${order.id}`;

        await supabase.from("human_tasks").upsert(
          {
            company_id: order.company_id,
            dedupe_key: dedupeKey,
            title: `Revision Escalation: ${order.order_number} (${order.customer_revision_count} revisions)`,
            description: `Order has ${order.customer_revision_count} revisions. Change Order required. Escalated to Sales + Ops.`,
            severity: "critical",
            category: "sla_breach",
            entity_type: "order",
            entity_id: order.id,
            status: "open",
          },
          { onConflict: "dedupe_key", ignoreDuplicates: true }
        );
        breachCount++;
      }
    }

    return new Response(
      JSON.stringify({ breaches_processed: breachCount, checked_at: now.toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("check-sla-breaches error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
