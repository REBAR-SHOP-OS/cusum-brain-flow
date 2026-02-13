import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, requireAuth, json } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userId, serviceClient: supabase } = await requireAuth(req);
    const { action_id } = await req.json();

    if (!action_id) return json({ error: "action_id required" }, 400);

    // Load the action
    const { data: action, error: loadErr } = await supabase
      .from("penny_collection_queue")
      .select("*")
      .eq("id", action_id)
      .single();

    if (loadErr || !action) return json({ error: "Action not found" }, 404);
    if (action.status !== "approved" && action.status !== "pending_approval") {
      return json({ error: `Action status is '${action.status}', cannot execute` }, 400);
    }

    // Mark as approved if still pending
    if (action.status === "pending_approval") {
      await supabase
        .from("penny_collection_queue")
        .update({ status: "approved", approved_by: userId, approved_at: new Date().toISOString() })
        .eq("id", action_id);
    }

    let result: Record<string, unknown> = {};

    switch (action.action_type) {
      case "email_reminder":
      case "send_invoice": {
        // Try to send via QuickBooks if invoice exists
        if (action.invoice_id && action.customer_email) {
          try {
            const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
            const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
            const resp = await fetch(`${supabaseUrl}/functions/v1/quickbooks-oauth`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${serviceKey}`,
              },
              body: JSON.stringify({
                action: "send-invoice",
                invoiceId: action.invoice_id,
                email: action.customer_email,
              }),
            });
            const qbResult = await resp.json();
            result = { method: "quickbooks_send", ...qbResult };
          } catch (err) {
            result = { method: "quickbooks_send", error: String(err) };
          }
        } else {
          result = { method: "draft_only", note: "No email or invoice ID — draft saved for manual sending" };
        }
        break;
      }

      case "call_collection": {
        // Create a call_task record
        const { data: callTask, error: callErr } = await supabase
          .from("call_tasks")
          .insert({
            company_id: action.company_id,
            contact_name: action.customer_name,
            phone: action.customer_phone || "unknown",
            reason: `Collection: Invoice overdue ${action.days_overdue} days — $${action.amount}`,
            details: (action.action_payload as Record<string, unknown>)?.call_script as string || null,
            status: "queued",
            user_id: userId,
          })
          .select("id")
          .single();

        if (callErr) {
          result = { method: "call_task", error: String(callErr) };
        } else {
          result = { method: "call_task", call_task_id: callTask?.id };
        }
        break;
      }

      case "escalate": {
        // Create a human_task for Vizzy
        const { data: agents } = await supabase
          .from("agents")
          .select("id")
          .eq("code", "vizzy")
          .single();

        if (agents?.id) {
          await supabase.from("human_tasks").insert({
            company_id: action.company_id,
            agent_id: agents.id,
            title: `Escalation: ${action.customer_name} — $${action.amount} overdue ${action.days_overdue}d`,
            description: action.ai_reasoning || "Penny has escalated this collection issue for CEO review.",
            severity: "critical",
            category: "collection_escalation",
            entity_type: "invoice",
            entity_id: action.invoice_id || action.id,
            status: "open",
            dedupe_key: `penny:escalate:${action.id}`,
          });
          result = { method: "escalated_to_vizzy", agent_id: agents.id };
        } else {
          result = { method: "escalation_failed", error: "Vizzy agent not found" };
        }
        break;
      }

      default:
        result = { error: `Unknown action_type: ${action.action_type}` };
    }

    // Update queue item as executed
    const finalStatus = result.error ? "failed" : "executed";
    await supabase
      .from("penny_collection_queue")
      .update({
        status: finalStatus,
        executed_at: new Date().toISOString(),
        execution_result: result,
        approved_by: userId,
      })
      .eq("id", action_id);

    // Auto-queue next follow-up if executed successfully
    if (finalStatus === "executed" && action.action_type !== "escalate") {
      const nextFollowupDays = action.action_type === "email_reminder" ? 7 : 14;
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + nextFollowupDays);

      // Determine next action type escalation
      const nextActionType = action.action_type === "email_reminder" ? "call_collection"
        : action.action_type === "call_collection" ? "send_invoice"
        : "escalate";

      await supabase.from("penny_collection_queue").insert({
        company_id: action.company_id,
        invoice_id: action.invoice_id,
        customer_name: action.customer_name,
        customer_email: action.customer_email,
        customer_phone: action.customer_phone,
        amount: action.amount,
        days_overdue: (action.days_overdue || 0) + nextFollowupDays,
        action_type: nextActionType,
        action_payload: {},
        status: "pending_approval",
        priority: nextActionType === "escalate" ? "critical" : "high",
        ai_reasoning: `Auto-follow-up after ${action.action_type} on ${new Date().toLocaleDateString()}. Previous action was executed successfully.`,
        followup_date: nextDate.toISOString().split("T")[0],
        followup_count: (action.followup_count || 0) + 1,
      });
    }

    return json({ executed: true, result, status: finalStatus });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("penny-execute-action error:", e);
    return json({ error: String(e) }, 500);
  }
});
