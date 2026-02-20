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
      .eq("automation_key", "ar_aging_escalation")
      .maybeSingle();

    if (!config?.enabled) {
      return new Response(JSON.stringify({ skipped: true, reason: "disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get overdue invoices from accounting_mirror
    const { data: invoices } = await supabase
      .from("accounting_mirror")
      .select("*")
      .eq("entity_type", "invoice")
      .gt("balance", 0);

    let processed = 0;
    let actions = 0;
    const now = new Date();

    for (const inv of invoices || []) {
      const data = inv.data as any;
      const dueDate = data?.DueDate ? new Date(data.DueDate) : null;
      if (!dueDate) continue;

      const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysOverdue <= 0) continue;

      processed++;

      // Determine escalation level
      let actionType: string;
      let priority: string;
      let description: string;

      if (daysOverdue >= 90) {
        actionType = "escalate";
        priority = "critical";
        description = `CRITICAL: Invoice ${data?.DocNumber || inv.quickbooks_id} is ${daysOverdue} days overdue ($${inv.balance}). Account flagged for review.`;
      } else if (daysOverdue >= 60) {
        actionType = "call_collection";
        priority = "high";
        description = `Invoice ${data?.DocNumber || inv.quickbooks_id} is ${daysOverdue} days overdue ($${inv.balance}). Escalating to human collection call.`;
      } else if (daysOverdue >= 30) {
        actionType = "email_reminder";
        priority = "medium";
        description = `Invoice ${data?.DocNumber || inv.quickbooks_id} is ${daysOverdue} days overdue ($${inv.balance}). Sending friendly reminder.`;
      } else {
        continue;
      }

      // Check if action already exists for this invoice
      const { data: existing } = await supabase
        .from("penny_collection_queue")
        .select("id")
        .eq("invoice_id", inv.id)
        .in("status", ["pending_approval", "approved"])
        .maybeSingle();

      if (existing) continue;

      // Queue collection action
      try {
        await supabase.from("penny_collection_queue").insert({
          company_id: inv.company_id,
          invoice_id: inv.id,
          customer_name: data?.CustomerRef?.name || "Unknown",
          customer_email: data?.BillEmail?.Address || null,
          amount: inv.balance || 0,
          days_overdue: daysOverdue,
          action_type: actionType,
          action_payload: {
            doc_number: data?.DocNumber,
            due_date: data?.DueDate,
            escalation_level: daysOverdue >= 90 ? 3 : daysOverdue >= 60 ? 2 : 1,
          },
          status: "pending_approval",
          priority: priority,
          ai_reasoning: description,
        });
        actions++;
      } catch (_) {}
    }

    // Log run
    try {
      await supabase.from("automation_runs").insert({
        company_id: "a0000000-0000-0000-0000-000000000001",
        automation_key: "ar_aging_escalation",
        automation_name: "AR Aging Escalation",
        agent_name: "Penny",
        trigger_type: "cron",
        status: "completed",
        items_processed: processed,
        items_succeeded: actions,
        completed_at: new Date().toISOString(),
      });
    } catch (_) {}

    return new Response(JSON.stringify({ processed, actions_queued: actions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("ar-aging-escalation error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
