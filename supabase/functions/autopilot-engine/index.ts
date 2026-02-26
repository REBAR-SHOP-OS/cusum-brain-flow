import { corsHeaders, requireAuth, json } from "../_shared/auth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Risk level hierarchy for comparison ──
const RISK_HIERARCHY: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };

function higherRisk(a: string, b: string): string {
  return (RISK_HIERARCHY[a] ?? 1) >= (RISK_HIERARCHY[b] ?? 1) ? a : b;
}

// ── Hardcoded fallback for protected models (used if DB query fails) ──
const FALLBACK_PROTECTED_MODELS = [
  "account.move", "account.payment", "account.bank.statement",
  "hr.payslip", "hr.employee", "res.users", "res.partner",
  "stock.quant", "product.template",
];

// ── Table-driven risk computation ──
async function computeRiskFromDb(
  svcClient: ReturnType<typeof createClient>,
  toolName: string,
  toolParams: Record<string, unknown>,
): Promise<{ risk_level: string; requires_approval: boolean; warnings: string[] }> {
  const warnings: string[] = [];
  let risk = "medium";
  let matchedPolicy = false;

  const model = (toolParams.model as string) || "";
  const fields = Object.keys((toolParams.values as Record<string, unknown>) || {});

  try {
    // 1) Check protected models table
    if (model) {
      const { data: protectedRow } = await svcClient
        .from("autopilot_protected_models")
        .select("risk_level")
        .eq("model", model)
        .maybeSingle();
      if (protectedRow) {
        matchedPolicy = true;
        risk = higherRisk(risk, protectedRow.risk_level);
        warnings.push(`Protected model: ${model} (${protectedRow.risk_level})`);
      }
    }

    // 2) Query risk policies — match by tool, optionally model, optionally field
    const { data: policies } = await svcClient
      .from("autopilot_risk_policies")
      .select("risk_level, model, field, notes")
      .eq("tool_name", toolName);

    if (policies && policies.length > 0) {
      for (const p of policies) {
        const modelMatch = !p.model || p.model === model;
        const fieldMatch = !p.field || fields.includes(p.field);
        if (modelMatch && fieldMatch) {
          matchedPolicy = true;
          risk = higherRisk(risk, p.risk_level);
          if (p.notes) warnings.push(p.notes);
        }
      }
    }
  } catch (e) {
    // Fallback to hardcoded if DB query fails
    console.error("Risk policy DB query failed, using fallback:", e);
    return computeRiskFallback(toolName, toolParams);
  }

  // If no policy or protected model matched, use fallback logic
  if (!matchedPolicy) {
    return computeRiskFallback(toolName, toolParams);
  }

  return { risk_level: risk, requires_approval: risk !== "low", warnings };
}

// ── Fallback risk computation (original hardcoded logic) ──
function computeRiskFallback(toolName: string, toolParams: Record<string, unknown>): {
  risk_level: string; requires_approval: boolean; warnings: string[];
} {
  const warnings: string[] = [];
  let risk = "medium";
  if (toolName === "odoo_write") {
    const model = (toolParams.model as string) || "";
    const action = (toolParams.action as string) || "write";
    if (FALLBACK_PROTECTED_MODELS.includes(model)) {
      risk = "critical";
      warnings.push(`Protected model: ${model}`);
    }
    if (action === "create") { warnings.push("Creates new record"); }
    if (action === "write") {
      const fields = Object.keys((toolParams.values as Record<string, unknown>) || {});
      if (fields.includes("state") || fields.includes("stage_id")) {
        risk = higherRisk(risk, "high");
        warnings.push("Modifies state/stage field");
      }
    }
  } else if (toolName === "generate_patch") {
    risk = "high";
    warnings.push("Generates code patch requiring review");
  } else if (toolName === "validate_code") {
    risk = "low";
  } else {
    warnings.push(`Unknown tool: ${toolName}`);
  }
  return { risk_level: risk, requires_approval: risk !== "low", warnings };
}

// ── Simulate action preview ──
function simulateAction(toolName: string, toolParams: Record<string, unknown>): {
  preview: Record<string, unknown>; warnings: string[];
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
    preview.allow_write = toolParams.allow_write === true;
    if (!preview.allow_write) warnings.push("⚠️ allow_write flag not set — execution will be blocked");
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

// ── Odoo authentication helper ──
async function odooAuth(): Promise<{ uid: number; url: string; db: string; apiKey: string } | null> {
  const odooUrl = Deno.env.get("ODOO_URL");
  const odooDb = Deno.env.get("ODOO_DATABASE");
  const odooApiKey = Deno.env.get("ODOO_API_KEY");
  const odooUsername = Deno.env.get("ODOO_USERNAME");
  if (!odooUrl || !odooDb || !odooApiKey || !odooUsername) return null;

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
  if (!uid) return null;
  return { uid, url: odooUrl, db: odooDb, apiKey: odooApiKey };
}

// ── Preflight: read current values before writing ──
async function preflightRead(
  odoo: { uid: number; url: string; db: string; apiKey: string },
  model: string,
  recordId: number,
  fields: string[],
): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${odoo.url}/jsonrpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", method: "call", id: 99,
        params: {
          service: "object", method: "execute_kw",
          args: [odoo.db, odoo.uid, odoo.apiKey, model, "read", [[recordId]], { fields }],
        },
      }),
    });
    const data = await res.json();
    if (data.result && Array.isArray(data.result) && data.result.length > 0) {
      return data.result[0];
    }
    return null;
  } catch {
    return null;
  }
}

// ── Execute a single tool ──
async function executeTool(
  toolName: string,
  toolParams: Record<string, unknown>,
  svcClient: ReturnType<typeof createClient>,
  userId: string,
  companyId: string,
  actionId?: string,
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  if (toolName === "odoo_write") {
    // ODOO_ENABLED feature flag guard
    if (Deno.env.get("ODOO_ENABLED") !== "true") {
      return { success: false, error: "Odoo integration is disabled. odoo_write is no longer available." };
    }

    // A) Enforce explicit write flag
    if (toolParams.allow_write !== true) {
      return { success: false, error: "allow_write flag required — set allow_write: true in tool_params to confirm write intent" };
    }

    const odoo = await odooAuth();
    if (!odoo) return { success: false, error: "Odoo credentials not configured" };

    const method = toolParams.action === "create" ? "create" : "write";
    const model = (toolParams.model as string) || "";
    const values = (toolParams.values as Record<string, unknown>) || {};
    const recordId = toolParams.record_id as number;

    // B) Preflight rollback capture for writes
    if (method === "write" && recordId && actionId) {
      const fieldsToChange = Object.keys(values);
      const originalValues = await preflightRead(odoo, model, recordId, fieldsToChange);
      if (originalValues) {
        await svcClient.from("autopilot_actions").update({
          rollback_metadata: { model, record_id: recordId, original_values: originalValues },
        }).eq("id", actionId);
      }
    }

    const rpcArgs = method === "create"
      ? [values]
      : [[recordId], values];
    const rpcRes = await fetch(`${odoo.url}/jsonrpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", method: "call", id: 2,
        params: { service: "object", method: "execute_kw", args: [odoo.db, odoo.uid, odoo.apiKey, model, method, rpcArgs] },
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
      const odoo = await odooAuth();
      if (!odoo) return false;
      await fetch(`${odoo.url}/jsonrpc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", method: "call", id: 3,
          params: {
            service: "object", method: "execute_kw",
            args: [odoo.db, odoo.uid, odoo.apiKey, rollbackMeta.model, "write", [[rollbackMeta.record_id], rollbackMeta.original_values]],
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
      const risk = await computeRiskFromDb(svcClient, tool_name, tool_params || {});
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

      const { data: run } = await svcClient
        .from("autopilot_runs")
        .select("id, status, company_id")
        .eq("id", run_id)
        .eq("company_id", companyId)
        .single();
      if (!run) return json({ error: "Run not found" }, 404);
      if (run.status !== "awaiting_approval") return json({ error: `Cannot approve run in status: ${run.status}` }, 400);

      await svcClient.from("autopilot_runs").update({
        status: "approved",
        phase: "execution",
        approved_by: userId,
        approved_at: new Date().toISOString(),
        approval_note: approval_note || null,
      }).eq("id", run_id);

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

      if (!["awaiting_approval", "approved"].includes(run.status)) {
        return json({ error: `Cannot reject run in status: ${run.status}` }, 400);
      }

      await svcClient.from("autopilot_runs").update({
        status: "cancelled",
        phase: "cancelled",
        approval_note: approval_note || "Rejected by admin",
      }).eq("id", run_id);

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
    // ACTION: execute_run (idempotent + resumable + locked)
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

      // D) Allow approved OR failed (for resumability)
      if (!["approved", "failed"].includes(run.status)) {
        return json({ error: `Cannot execute run in status: ${run.status}` }, 400);
      }

      // D) Atomic lock acquisition via RPC
      const lockUuid = crypto.randomUUID();
      const { data: lockResult, error: lockError } = await svcClient.rpc("acquire_autopilot_lock", {
        _run_id: run_id,
        _company_id: companyId,
        _lock_uuid: lockUuid,
      });
      if (lockError || !lockResult || lockResult === 0) {
        console.log("LOCK_REJECTED", { run_id, attempted_lock: lockUuid, error: lockError?.message });
        return json({ error: "Run is locked by another execution" }, 423);
      }
      console.log("LOCK_ACQUIRED", { run_id, lock_uuid: lockUuid });

      // Load actions ordered by step_order
      const { data: actions } = await svcClient
        .from("autopilot_actions")
        .select("*")
        .eq("run_id", run_id)
        .order("step_order", { ascending: true });

      if (!actions || actions.length === 0) {
        // Release lock
        await svcClient.from("autopilot_runs").update({ execution_lock_uuid: null }).eq("id", run_id);
        return json({ error: "No actions found for this run" }, 400);
      }

      const startTime = Date.now();
      let executedCount = 0;
      let failedCount = 0;
      let skippedCount = 0;
      const results: Array<{ action_id: string; status: string; tool: string }> = [];

      for (const act of actions) {
        // D) Skip already completed actions (idempotent)
        if (act.status === "completed") {
          results.push({ action_id: act.id, status: "already_completed", tool: act.tool_name });
          skippedCount++;
          continue;
        }

        // D) Timeout stale executing actions
        if (act.status === "executing" && !act.executed_at) {
          const actionAge = Date.now() - new Date(act.updated_at || act.created_at).getTime();
          if (actionAge > 5 * 60 * 1000) {
            await svcClient.from("autopilot_actions").update({
              status: "failed",
              error_message: "Execution timeout (>5 minutes stale)",
              executed_at: new Date().toISOString(),
            }).eq("id", act.id);
            failedCount++;
            results.push({ action_id: act.id, status: "timeout", tool: act.tool_name });
            continue;
          }
        }

        // Only execute approved actions
        const canExecute = act.status === "approved" || (!act.requires_approval && act.status !== "rejected");
        if (!canExecute) {
          if (act.status === "pending") {
            await svcClient.from("autopilot_actions").update({ status: "skipped" }).eq("id", act.id);
          }
          skippedCount++;
          results.push({ action_id: act.id, status: "skipped", tool: act.tool_name });
          continue;
        }

        // C) Re-compute risk server-side from DB
        const serverRisk = await computeRiskFromDb(svcClient, act.tool_name, act.tool_params as Record<string, unknown>);
        if (serverRisk.requires_approval && act.status !== "approved") {
          await svcClient.from("autopilot_actions").update({
            status: "skipped",
            error_message: `Server-side risk escalated to ${serverRisk.risk_level} — approval required`,
          }).eq("id", act.id);
          skippedCount++;
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
          act.id,
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
          if (Object.keys(rollbackMeta).length > 0 && rollbackMeta.original_values) {
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

      // Release lock and finalize
      await svcClient.from("autopilot_runs").update({
        phase: finalPhase,
        status: finalStatus,
        completed_at: new Date().toISOString(),
        execution_lock_uuid: null,
        metrics: {
          executed_actions: executedCount,
          failed_actions: failedCount,
          skipped_actions: skippedCount,
          total_actions: actions.length,
          duration_ms: durationMs,
        },
      }).eq("id", run_id);

      return json({
        success: true,
        run_id,
        status: finalStatus,
        dry_run,
        metrics: { executed_actions: executedCount, failed_actions: failedCount, skipped_actions: skippedCount, duration_ms: durationMs },
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
