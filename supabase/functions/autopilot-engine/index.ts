import { corsHeaders, requireAuth, json } from "../_shared/auth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Protected Odoo models that bump risk to "critical" ──
const PROTECTED_ODOO_MODELS = [
  "account.move", "account.payment", "account.bank.statement",
  "hr.payslip", "hr.employee", "res.users", "res.partner",
  "stock.quant", "product.template",
];

// ── Server-side risk computation (never trust AI-provided risk) ──
function computeRisk(toolName: string, toolParams: Record<string, unknown>): {
  risk_level: string;
  requires_approval: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  let risk = "medium";

  if (toolName === "odoo_write") {
    const model = (toolParams.model as string) || "";
    const action = (toolParams.action as string) || "write";

    if (PROTECTED_ODOO_MODELS.includes(model)) {
      risk = "critical";
      warnings.push(`Protected model: ${model}`);
    }
    if (action === "create") {
      if (risk !== "critical") risk = "medium";
      warnings.push("Creates new record");
    }
    if (action === "write") {
      const fields = Object.keys((toolParams.values as Record<string, unknown>) || {});
      if (fields.includes("state") || fields.includes("stage_id")) {
        risk = risk === "critical" ? "critical" : "high";
        warnings.push("Modifies state/stage field");
      }
    }
  } else if (toolName === "generate_patch") {
    risk = "high";
    warnings.push("Generates code patch requiring review");
  } else if (toolName === "validate_code") {
    risk = "low";
  } else {
    risk = "medium";
    warnings.push(`Unknown tool: ${toolName}`);
  }

  return {
    risk_level: risk,
    requires_approval: risk !== "low",
    warnings,
  };
}

// ── Simulate action preview ──
function simulateAction(toolName: string, toolParams: Record<string, unknown>): {
  preview: Record<string, unknown>;
  warnings: string[];
} {
  const warnings: string[] = [];
  const preview: Record<string, unknown> = { tool: toolName };

  if (toolName === "odoo_write") {
    const model = (toolParams.model as string) || "unknown";
    const action = (toolParams.action as string) || "write";
    const values = (toolParams.values as Record<string, unknown>) || {};
    preview.model = model;
    preview.operation = action;
    preview.fields_affected = Object.keys(values);
    preview.record_id = toolParams.record_id || null;
    preview.touches_protected_model = PROTECTED_ODOO_MODELS.includes(model);
    if (preview.touches_protected_model) warnings.push(`⚠️ Touches protected model: ${model}`);
    if (Object.keys(values).length === 0) warnings.push("No fields specified in values");
  } else if (toolName === "generate_patch") {
    preview.file_path = toolParams.file_path;
    preview.target_system = toolParams.target_system || "odoo";
    preview.patch_type = toolParams.patch_type || "unified_diff";
    preview.content_length = ((toolParams.patch_content as string) || "").length;
    warnings.push("Patch will require human code review");
  } else {
    preview.params = toolParams;
  }

  return { preview, warnings };
}

// ── Execute a single tool ──
async function executeTool(
  toolName: string,
  toolParams: Record<string, unknown>,
  svcClient: ReturnType<typeof createClient>,
  userId: string,
  companyId: string,
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  if (toolName === "odoo_write") {
    const odooUrl = Deno.env.get("ODOO_URL");
    const odooDb = Deno.env.get("ODOO_DATABASE");
    const odooApiKey = Deno.env.get("ODOO_API_KEY");
    const odooUsername = Deno.env.get("ODOO_USERNAME");
    if (!odooUrl || !odooDb || !odooApiKey || !odooUsername) {
      return { success: false, error: "Odoo credentials not configured" };
    }
    const authRes = await fetch(`${odooUrl}/jsonrpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", method: "call", id: 1,
        params: { service: "common", method: "login", args: [odooDb, odooUsername, odooApiKey] },
      }),
    });
    const authData = await authRes.json();
    const uid = authData.result;
    if (!uid) return { success: false, error: "Odoo auth failed" };

    const method = toolParams.action === "create" ? "create" : "write";
    const rpcArgs = method === "create"
      ? [toolParams.values]
      : [[toolParams.record_id], toolParams.values];
    const rpcRes = await fetch(`${odooUrl}/jsonrpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", method: "call", id: 2,
        params: { service: "object", method: "execute_kw", args: [odooDb, uid, odooApiKey, toolParams.model, method, rpcArgs] },
      }),
    });
    const rpcData = await rpcRes.json();
    if (rpcData.error) return { success: false, error: rpcData.error.message || "Odoo RPC error" };
    return { success: true, result: rpcData.result };
  }

  if (toolName === "generate_patch") {
    const { data: patch, error } = await svcClient.from("code_patches").insert({
      created_by: userId,
      company_id: companyId,
      target_system: (toolParams.target_system as string) || "odoo",
      file_path: toolParams.file_path as string,
      description: (toolParams.description as string) || "",
      patch_content: toolParams.patch_content as string,
      patch_type: (toolParams.patch_type as string) || "unified_diff",
      status: "pending",
    }).select("id").single();
    if (error) return { success: false, error: error.message };
    return { success: true, result: { patch_id: patch.id } };
  }

  return { success: false, error: `Unsupported tool: ${toolName}` };
}

// ── Attempt rollback for a failed action ──
async function attemptRollback(
  toolName: string,
  rollbackMeta: Record<string, unknown>,
  svcClient: ReturnType<typeof createClient>,
): Promise<boolean> {
  try {
    if (toolName === "odoo_write" && rollbackMeta.original_values) {
      const odooUrl = Deno.env.get("ODOO_URL");
      const odooDb = Deno.env.get("ODOO_DATABASE");
      const odooApiKey = Deno.env.get("ODOO_API_KEY");
      const odooUsername = Deno.env.get("ODOO_USERNAME");
      if (!odooUrl || !odooDb || !odooApiKey || !odooUsername) return false;

      const authRes = await fetch(`${odooUrl}/jsonrpc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", method: "call", id: 1,
          params: { service: "common", method: "login", args: [odooDb, odooUsername, odooApiKey] },
        }),
      });
      const uid = (await authRes.json()).result;
      if (!uid) return false;

      await fetch(`${odooUrl}/jsonrpc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", method: "call", id: 3,
          params: {
            service: "object", method: "execute_kw",
            args: [odooDb, uid, odooApiKey, rollbackMeta.model, "write", [[rollbackMeta.record_id], rollbackMeta.original_values]],
          },
        }),
      });
      return true;
    }
    if (toolName === "generate_patch" && rollbackMeta.patch_id) {
      await svcClient.from("code_patches").update({ status: "rejected" }).eq("id", rollbackMeta.patch_id);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// ── Main handler ──
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await requireAuth(req);
    const { userId, serviceClient: svcClient } = auth;
    const body = await req.json();
    const { action } = body;

    // Get user's company_id
    const { data: profile } = await svcClient
      .from("profiles")
      .select("company_id")
      .eq("user_id", userId)
      .single();
    const companyId = profile?.company_id;
    if (!companyId) return json({ error: "No company" }, 403);

    // Check admin role
    const { data: roleRow } = await svcClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["admin"])
      .maybeSingle();
    const isAdmin = !!roleRow;

    // ════════════════════════════════════════════
    // ACTION: simulate_action
    // ════════════════════════════════════════════
    if (action === "simulate_action") {
      const { tool_name, tool_params } = body;
      if (!tool_name) return json({ error: "tool_name required" }, 400);
      const risk = computeRisk(tool_name, tool_params || {});
      const sim = simulateAction(tool_name, tool_params || {});
      return json({
        risk_level: risk.risk_level,
        requires_approval: risk.requires_approval,
        preview: sim.preview,
        warnings: [...risk.warnings, ...sim.warnings],
      });
    }

    // ════════════════════════════════════════════
    // ACTION: approve_run
    // ════════════════════════════════════════════
    if (action === "approve_run") {
      if (!isAdmin) return json({ error: "Admin only" }, 403);
      const { run_id, approval_note } = body;
      if (!run_id) return json({ error: "run_id required" }, 400);

      // Verify run belongs to company
      const { data: run } = await svcClient
        .from("autopilot_runs")
        .select("id, status, company_id")
        .eq("id", run_id)
        .eq("company_id", companyId)
        .single();
      if (!run) return json({ error: "Run not found" }, 404);
      if (run.status !== "awaiting_approval") return json({ error: `Cannot approve run in status: ${run.status}` }, 400);

      // Approve the run
      await svcClient.from("autopilot_runs").update({
        status: "approved",
        phase: "execution",
        approved_by: userId,
        approved_at: new Date().toISOString(),
        approval_note: approval_note || null,
      }).eq("id", run_id);

      // Auto-approve all pending actions
      await svcClient.from("autopilot_actions").update({
        status: "approved",
        approved_by: userId,
        approved_at: new Date().toISOString(),
      }).eq("run_id", run_id).eq("status", "pending");

      return json({ success: true, message: "Run approved" });
    }

    // ════════════════════════════════════════════
    // ACTION: reject_run
    // ════════════════════════════════════════════
    if (action === "reject_run") {
      if (!isAdmin) return json({ error: "Admin only" }, 403);
      const { run_id, approval_note } = body;
      if (!run_id) return json({ error: "run_id required" }, 400);

      const { data: run } = await svcClient
        .from("autopilot_runs")
        .select("id, status, company_id")
        .eq("id", run_id)
        .eq("company_id", companyId)
        .single();
      if (!run) return json({ error: "Run not found" }, 404);

      await svcClient.from("autopilot_runs").update({
        status: "cancelled",
        phase: "cancelled",
        approval_note: approval_note || "Rejected by admin",
      }).eq("id", run_id);

      // Reject all pending actions
      await svcClient.from("autopilot_actions").update({ status: "rejected" })
        .eq("run_id", run_id).eq("status", "pending");

      return json({ success: true, message: "Run rejected" });
    }

    // ════════════════════════════════════════════
    // ACTION: approve_action
    // ════════════════════════════════════════════
    if (action === "approve_action") {
      if (!isAdmin) return json({ error: "Admin only" }, 403);
      const { action_id } = body;
      if (!action_id) return json({ error: "action_id required" }, 400);

      // Verify action belongs to company via run
      const { data: actionRow } = await svcClient
        .from("autopilot_actions")
        .select("id, status, run_id")
        .eq("id", action_id)
        .single();
      if (!actionRow) return json({ error: "Action not found" }, 404);

      const { data: run } = await svcClient
        .from("autopilot_runs")
        .select("company_id")
        .eq("id", actionRow.run_id)
        .eq("company_id", companyId)
        .single();
      if (!run) return json({ error: "Not authorized" }, 403);

      await svcClient.from("autopilot_actions").update({
        status: "approved",
        approved_by: userId,
        approved_at: new Date().toISOString(),
      }).eq("id", action_id);

      return json({ success: true, message: "Action approved" });
    }

    // ════════════════════════════════════════════
    // ACTION: reject_action
    // ════════════════════════════════════════════
    if (action === "reject_action") {
      if (!isAdmin) return json({ error: "Admin only" }, 403);
      const { action_id } = body;
      if (!action_id) return json({ error: "action_id required" }, 400);

      const { data: actionRow } = await svcClient
        .from("autopilot_actions")
        .select("id, run_id")
        .eq("id", action_id)
        .single();
      if (!actionRow) return json({ error: "Action not found" }, 404);

      const { data: run } = await svcClient
        .from("autopilot_runs")
        .select("company_id")
        .eq("id", actionRow.run_id)
        .eq("company_id", companyId)
        .single();
      if (!run) return json({ error: "Not authorized" }, 403);

      await svcClient.from("autopilot_actions").update({ status: "rejected" }).eq("id", action_id);

      return json({ success: true, message: "Action rejected" });
    }

    // ════════════════════════════════════════════
    // ACTION: execute_run
    // ════════════════════════════════════════════
    if (action === "execute_run") {
      if (!isAdmin) return json({ error: "Admin only" }, 403);
      const { run_id, dry_run = false } = body;
      if (!run_id) return json({ error: "run_id required" }, 400);

      // Load run
      const { data: run } = await svcClient
        .from("autopilot_runs")
        .select("*")
        .eq("id", run_id)
        .eq("company_id", companyId)
        .single();
      if (!run) return json({ error: "Run not found" }, 404);
      if (run.status !== "approved") return json({ error: `Cannot execute run in status: ${run.status}` }, 400);

      // Load actions ordered by step_order
      const { data: actions } = await svcClient
        .from("autopilot_actions")
        .select("*")
        .eq("run_id", run_id)
        .order("step_order", { ascending: true });

      if (!actions || actions.length === 0) {
        return json({ error: "No actions found for this run" }, 400);
      }

      // Mark run as executing
      await svcClient.from("autopilot_runs").update({
        phase: "execution",
        status: "executing",
        started_at: new Date().toISOString(),
      }).eq("id", run_id);

      const startTime = Date.now();
      let executedCount = 0;
      let failedCount = 0;
      const results: Array<{ action_id: string; status: string; tool: string }> = [];

      for (const act of actions) {
        // Only execute approved actions (or non-approval-required ones that are approved)
        const canExecute = act.status === "approved" || (!act.requires_approval && act.status !== "rejected");
        if (!canExecute) {
          results.push({ action_id: act.id, status: "skipped", tool: act.tool_name });
          if (act.status === "pending") {
            await svcClient.from("autopilot_actions").update({ status: "skipped" }).eq("id", act.id);
          }
          continue;
        }

        // Re-compute risk server-side — never trust stored risk
        const serverRisk = computeRisk(act.tool_name, act.tool_params as Record<string, unknown>);
        if (serverRisk.requires_approval && act.status !== "approved") {
          await svcClient.from("autopilot_actions").update({
            status: "skipped",
            error_message: `Server-side risk escalated to ${serverRisk.risk_level} — approval required`,
          }).eq("id", act.id);
          results.push({ action_id: act.id, status: "risk_escalated", tool: act.tool_name });
          continue;
        }

        if (dry_run) {
          results.push({ action_id: act.id, status: "dry_run_ok", tool: act.tool_name });
          continue;
        }

        // Mark executing
        await svcClient.from("autopilot_actions").update({ status: "executing" }).eq("id", act.id);

        const toolResult = await executeTool(
          act.tool_name,
          act.tool_params as Record<string, unknown>,
          svcClient,
          userId,
          companyId,
        );

        if (toolResult.success) {
          executedCount++;
          await svcClient.from("autopilot_actions").update({
            status: "completed",
            result: toolResult.result as any,
            executed_at: new Date().toISOString(),
          }).eq("id", act.id);
          results.push({ action_id: act.id, status: "completed", tool: act.tool_name });
        } else {
          failedCount++;
          await svcClient.from("autopilot_actions").update({
            status: "failed",
            error_message: toolResult.error || "Unknown error",
            executed_at: new Date().toISOString(),
          }).eq("id", act.id);

          // Attempt rollback if metadata exists
          const rollbackMeta = (act.rollback_metadata || {}) as Record<string, unknown>;
          if (Object.keys(rollbackMeta).length > 0) {
            const rolledBack = await attemptRollback(act.tool_name, rollbackMeta, svcClient);
            if (rolledBack) {
              await svcClient.from("autopilot_actions").update({ rollback_executed: true }).eq("id", act.id);
            }
          }

          results.push({ action_id: act.id, status: "failed", tool: act.tool_name });
        }
      }

      const durationMs = Date.now() - startTime;
      const finalStatus = failedCount > 0 ? "failed" : "completed";
      const finalPhase = "observation";

      await svcClient.from("autopilot_runs").update({
        phase: finalPhase,
        status: finalStatus,
        completed_at: new Date().toISOString(),
        metrics: {
          executed_actions: executedCount,
          failed_actions: failedCount,
          skipped_actions: actions.length - executedCount - failedCount,
          total_actions: actions.length,
          duration_ms: durationMs,
        },
      }).eq("id", run_id);

      return json({
        success: true,
        run_id,
        status: finalStatus,
        dry_run,
        metrics: { executed_actions: executedCount, failed_actions: failedCount, duration_ms: durationMs },
        results,
      });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("autopilot-engine error:", e);
    return json({ error: e instanceof Error ? e.message : "Internal error" }, 500);
  }
});
