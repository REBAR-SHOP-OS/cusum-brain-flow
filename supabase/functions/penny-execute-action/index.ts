import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { handleRequest } from "../_shared/requestHandler.ts";
import { json } from "../_shared/auth.ts";

/**
 * Executes a Penny collection action (email reminder, call, escalation).
 * Migrated to handleRequest wrapper (Phase 1.2).
 */
serve((req) =>
  handleRequest(req, async ({ userId, serviceClient, body }) => {
    const { action_id } = body;
    if (!action_id) throw json({ error: "action_id required" }, 400);

    // Load the action
    const { data: action, error: loadErr } = await serviceClient
      .from("penny_collection_queue")
      .select("*")
      .eq("id", action_id)
      .single();

    if (loadErr || !action) throw json({ error: "Action not found" }, 404);

    // Pre-execution payment check: if invoice is already paid, auto-resolve
    if (action.invoice_id) {
      const { data: mirrorRow } = await serviceClient
        .from("accounting_mirror")
        .select("balance")
        .eq("quickbooks_id", action.invoice_id)
        .eq("company_id", action.company_id)
        .maybeSingle();
      if (mirrorRow && (mirrorRow.balance ?? 0) <= 0) {
        await serviceClient
          .from("penny_collection_queue")
          .update({
            status: "rejected",
            execution_result: { reject_reason: "Invoice paid before execution — auto-resolved" },
            executed_at: new Date().toISOString(),
          })
          .eq("id", action_id);
        return { executed: false, result: { method: "auto_resolved", reason: "Invoice balance is $0 — already paid" }, status: "rejected" };
      }
    }

    if (action.status !== "approved" && action.status !== "pending_approval") {
      throw json({ error: `Action status is '${action.status}', cannot execute` }, 400);
    }

    // Mark as approved if still pending
    if (action.status === "pending_approval") {
      await serviceClient
        .from("penny_collection_queue")
        .update({ status: "approved", approved_by: userId, approved_at: new Date().toISOString() })
        .eq("id", action_id);
    }

    let result: Record<string, unknown> = {};

    switch (action.action_type) {
      case "email_reminder":
      case "send_invoice": {
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
        const { data: callTask, error: callErr } = await serviceClient
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
        const { data: agents } = await serviceClient
          .from("agents")
          .select("id")
          .eq("code", "vizzy")
          .single();

        if (agents?.id) {
          await serviceClient.from("human_tasks").insert({
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
    await serviceClient
      .from("penny_collection_queue")
      .update({
        status: finalStatus,
        executed_at: new Date().toISOString(),
        execution_result: result,
        approved_by: userId,
      })
      .eq("id", action_id);

    // Auto-create task for assigned user on successful execution
    if (finalStatus === "executed" && action.assigned_to) {
      try {
        const { data: approverProfile } = await serviceClient
          .from("profiles")
          .select("id")
          .eq("user_id", userId)
          .single();

        const taskDescription = [
          `Action: ${action.action_type}`,
          `Amount: $${action.amount}`,
          `Days overdue: ${action.days_overdue}`,
          action.ai_reasoning ? `AI reasoning: ${action.ai_reasoning}` : null,
          `Result: ${JSON.stringify(result)}`,
        ].filter(Boolean).join("\n");

        await serviceClient.from("tasks").insert({
          title: `Collection: ${action.customer_name} - $${action.amount}`,
          description: taskDescription,
          assigned_to: action.assigned_to,
          due_date: action.followup_date ? new Date(action.followup_date).toISOString() : null,
          status: "open",
          priority: action.priority === "critical" ? "high" : action.priority || "medium",
          company_id: action.company_id,
          source: "penny",
          source_ref: action.id,
          agent_type: "penny",
          created_by_profile_id: approverProfile?.id || null,
        });
      } catch (taskErr) {
        console.error("Failed to create task for assignee:", taskErr);
      }
    }

    // Auto-queue next follow-up if executed successfully
    if (finalStatus === "executed" && action.action_type !== "escalate") {
      const { data: existing } = await serviceClient
        .from("penny_collection_queue")
        .select("id")
        .eq("customer_name", action.customer_name)
        .eq("company_id", action.company_id)
        .eq("status", "pending_approval")
        .limit(1);

      if (!existing || existing.length === 0) {
        const nextFollowupDays = action.action_type === "email_reminder" ? 7 : 14;
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + nextFollowupDays);

        const nextActionType = action.action_type === "email_reminder" ? "call_collection"
          : action.action_type === "call_collection" ? "send_invoice"
          : "escalate";

        await serviceClient.from("penny_collection_queue").insert({
          company_id: action.company_id,
          invoice_id: action.invoice_id,
          customer_name: action.customer_name,
          customer_email: action.customer_email,
          customer_phone: action.customer_phone,
          amount: action.amount,
          days_overdue: (action.days_overdue || 0) + nextFollowupDays,
          action_type: nextActionType,
          action_payload: action.action_payload || {},
          status: "pending_approval",
          priority: nextActionType === "escalate" ? "critical" : "high",
          ai_reasoning: `Auto-follow-up after ${action.action_type} on ${new Date().toLocaleDateString()}. Previous action was executed successfully.`,
          followup_date: nextDate.toISOString().split("T")[0],
          followup_count: (action.followup_count || 0) + 1,
        });
      }
    }

    return { executed: true, result, status: finalStatus };
  }, { functionName: "penny-execute-action", requireCompany: false, wrapResult: false }),
);
