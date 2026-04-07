import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { corsHeaders } from "../_shared/auth.ts";
import { handleRequest } from "../_shared/requestHandler.ts";

// ═══════════════════════════════════════════════════════════
// HELPERS (inlined from lib/helpers.ts)
// ═══════════════════════════════════════════════════════════

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function logProductionEvent(
  supabaseService: ReturnType<typeof createClient>,
  companyId: string,
  eventType: string,
  metadata: Record<string, unknown>,
  description: string,
  entityId?: string,
  actorId?: string,
) {
  try {
    await supabaseService.from("production_events").insert({
      company_id: companyId,
      event_type: eventType,
      metadata,
      machine_id: metadata.machineId || null,
      session_id: metadata.sessionId || null,
      row_id: metadata.rowId || null,
      batch_id: metadata.batchId || null,
      triggered_by: actorId || null,
    });
  } catch (err) {
    console.error(`Failed to log production event ${eventType}:`, err);
  }
}

async function flushEvents(
  supabaseService: ReturnType<typeof createClient>,
  events: Record<string, unknown>[],
  companyId: string,
) {
  if (events.length === 0) return;
  const { error } = await supabaseService
    .from("activity_events")
    .insert(events.map((e: any) => ({ ...e, source: "system", company_id: companyId })));
  if (error) console.error("Failed to log events:", error);
}

interface ActionContext {
  userId: string;
  machineId: string;
  machine: any;
  body: any;
  roles: string[];
  supabaseUser: ReturnType<typeof createClient>;
  supabaseService: ReturnType<typeof createClient>;
  events: Record<string, unknown>[];
  now: string;
}

// ═══════════════════════════════════════════════════════════
// HANDLER: update-status
// ═══════════════════════════════════════════════════════════

async function handleUpdateStatus(ctx: ActionContext) {
  const { body, machine, machineId, userId, supabaseUser, events, now } = ctx;
  const { status } = body;
  const valid = ["idle", "running", "blocked", "down"];
  if (!valid.includes(status)) {
    return json({ error: `Invalid status: ${status}` }, 400);
  }

  const oldStatus = machine.status;
  const { error } = await supabaseUser
    .from("machines")
    .update({ status, last_event_at: now })
    .eq("id", machineId);
  if (error) throw error;

  if (oldStatus !== status) {
    events.push({
      entity_type: "machine",
      entity_id: machineId,
      event_type: "machine_status_changed",
      actor_id: userId,
      actor_type: "user",
      description: `Machine ${machine.name}: ${oldStatus} → ${status}`,
      metadata: { machineId, machineName: machine.name, oldStatus, newStatus: status },
    });
  }
  return null;
}

// ═══════════════════════════════════════════════════════════
// HANDLER: assign-operator
// ═══════════════════════════════════════════════════════════

async function handleAssignOperator(ctx: ActionContext) {
  const { body, machine, machineId, userId, supabaseUser, events, now } = ctx;
  const { operatorProfileId } = body;
  const { error } = await supabaseUser
    .from("machines")
    .update({
      current_operator_profile_id: operatorProfileId || null,
      last_event_at: now,
    })
    .eq("id", machineId);
  if (error) throw error;

  events.push({
    entity_type: "machine",
    entity_id: machineId,
    event_type: "operator_assigned",
    actor_id: userId,
    actor_type: "user",
    description: `Operator ${operatorProfileId ? "assigned to" : "removed from"} ${machine.name}`,
    metadata: { machineId, operatorProfileId: operatorProfileId || null },
  });
  return null;
}

// ═══════════════════════════════════════════════════════════
// HANDLER: start-run
// ═══════════════════════════════════════════════════════════

async function handleStartRun(ctx: ActionContext): Promise<{ response?: Response; machineRunId?: string }> {
  const { body, machine, machineId, userId, supabaseUser, supabaseService, events, now } = ctx;
  const { process, workOrderId, notes, barCode, qty, cutPlanItemId, cutPlanId, assignedBy } = body;

  const validProcesses = ["cut", "bend", "load", "pickup", "delivery", "clearance", "other"];
  if (!validProcesses.includes(process)) {
    return { response: json({ error: `Invalid process: ${process}` }, 400) };
  }
  // ── Cancel any orphaned running runs for this machine (not linked as current_run_id) ──
  {
    const { data: orphanRuns } = await supabaseService
      .from("machine_runs").select("id")
      .eq("machine_id", machineId).eq("status", "running")
      .neq("id", machine.current_run_id || "00000000-0000-0000-0000-000000000000");
    if (orphanRuns?.length) {
      for (const orphan of orphanRuns) {
        await supabaseService.from("machine_runs")
          .update({ status: "canceled", ended_at: now, notes: "Auto-canceled: orphan run on start-run" })
          .eq("id", orphan.id);
        console.warn(`[startRun] Canceled orphan run ${orphan.id} on ${machine.name}`);
      }
    }
  }

  if (machine.current_run_id) {
    const { data: existingRun } = await supabaseService
      .from("machine_runs").select("id, status, started_at")
      .eq("id", machine.current_run_id).maybeSingle();

    const isOrphan = !existingRun;
    const isInactive = existingRun && ["paused", "completed", "canceled", "rejected"].includes(existingRun.status);

    // Idempotency: if existing run is <5s old and still running, treat as double-tap and return it
    const ageMs = existingRun?.started_at ? Date.now() - new Date(existingRun.started_at).getTime() : Infinity;
    if (existingRun && existingRun.status === "running" && ageMs < 5000) {
      console.warn(`[startRun] Double-tap detected (<5s) on ${machine.name}, returning existing run ${existingRun.id}`);
      return { machineRunId: existingRun.id };
    }

    // ── Auto-recover if active_job_id points to a completed/done/moved-on item ──
    let activeJobDone = false;
    if (machine.active_job_id && existingRun?.status === "running") {
      const { data: activeItem } = await supabaseService
        .from("cut_plan_items").select("id, phase, completed_pieces, total_pieces")
        .eq("id", machine.active_job_id).maybeSingle();
      // Recover if item no longer exists, or has moved past the cutting phase, or is fully done
      const donePhases = ["cut_done", "bending", "bend_done", "done", "complete"];
      if (!activeItem || donePhases.includes(activeItem.phase) || activeItem.completed_pieces >= activeItem.total_pieces) {
        console.warn(`[startRun] Active job ${machine.active_job_id} is ${activeItem?.phase ?? 'MISSING'} (${activeItem?.completed_pieces ?? '?'}/${activeItem?.total_pieces ?? '?'}), auto-recovering`);
        activeJobDone = true;
      }
    }

    if (isOrphan || isInactive || activeJobDone) {
      const reason = isOrphan ? "orphan" : isInactive ? `inactive (${existingRun!.status})` : "active_job_done";
      console.warn(`[startRun] Auto-recovering ${reason} run ${machine.current_run_id} on ${machine.name}`);
      if (existingRun && !["completed", "canceled", "rejected"].includes(existingRun.status)) {
        await supabaseService.from("machine_runs")
          .update({ status: "canceled", ended_at: now, notes: `Auto-canceled: ${reason} run recovery` })
          .eq("id", machine.current_run_id);
      }
      await supabaseService.from("machines").update({
        current_run_id: null, active_job_id: null, active_plan_id: null,
        cut_session_status: "idle", machine_lock: false, job_assigned_by: null,
        status: "idle", last_event_at: now,
      }).eq("id", machineId);

      await logProductionEvent(supabaseService, machine.company_id, "stale_run_auto_recovered", {
        machineId, machineName: machine.name, staleRunId: machine.current_run_id, isOrphan, isInactive, activeJobDone, reason,
      }, `Auto-recovered ${reason} run on ${machine.name}`, machineId, userId);

      machine.current_run_id = null;
      machine.active_job_id = null;
      machine.active_plan_id = null;
      machine.cut_session_status = "idle";
      machine.machine_lock = false;
    } else {
      return { response: json({ error: "Machine already has an active run" }, 400) };
    }
  }

  // HARD JOB LOCK CHECK
  if (
    machine.cut_session_status === "running" &&
    machine.active_job_id &&
    cutPlanItemId &&
    machine.active_job_id !== cutPlanItemId
  ) {
    await logProductionEvent(supabaseService, machine.company_id, "cutter_switch_blocked", {
      machineId, machineName: machine.name,
      activeJobId: machine.active_job_id, attemptedJobId: cutPlanItemId,
      assignedBy: machine.job_assigned_by,
    }, `BLOCKED: Job switch on ${machine.name}`, machineId, userId);
    return {
      response: json({
        error: `Machine ${machine.name} is locked to active job. Complete or pause current job first.`,
        lockedJobId: machine.active_job_id,
      }, 403),
    };
  }

  // CUTTER ROUTING ENFORCEMENT
  if (barCode && process === "cut") {
    const CUTTER_01 = "e2dfa6e1-8a49-48eb-82a8-2be40e20d4b3";
    const CUTTER_02 = "b0000000-0000-0000-0000-000000000002";
    const barNum = parseInt(barCode.replace(/\D/g, "")) || 0;
    const isSmall = barNum <= 15;

    if (machineId === CUTTER_01 && !isSmall) {
      await logProductionEvent(supabaseService, machine.company_id, "machine_size_routing_blocked", {
        machineId, machineName: machine.name, barCode, reason: `${barCode} not allowed on Cutter-01`,
      }, `BLOCKED: ${barCode} on Cutter-01`, machineId, userId);
      return { response: json({ error: `Routing blocked: ${barCode} cannot run on ${machine.name}. Only 10M and 15M allowed.` }, 403) };
    }
    if (machineId === CUTTER_02 && isSmall) {
      await logProductionEvent(supabaseService, machine.company_id, "machine_size_routing_blocked", {
        machineId, machineName: machine.name, barCode, reason: `${barCode} not allowed on Cutter-02`,
      }, `BLOCKED: ${barCode} on Cutter-02`, machineId, userId);
      return { response: json({ error: `Routing blocked: ${barCode} cannot run on ${machine.name}. Only 20M+ allowed.` }, 403) };
    }
  }

  // CAPABILITY VALIDATION
  if (barCode) {
    const { data: rebarSize, error: rebarErr } = await supabaseService
      .from("rebar_sizes").select("bar_code, diameter_mm").eq("bar_code", barCode).single();
    if (rebarErr || !rebarSize) {
      return { response: json({ error: `Invalid bar_code: ${barCode}. Must be a valid RSIC Canada size.` }, 400) };
    }

    const { data: capability } = await supabaseService
      .from("machine_capabilities").select("bar_code, process, max_bars")
      .eq("machine_id", machineId).eq("bar_code", barCode).eq("process", process).maybeSingle();

    if (!capability) {
      events.push({
        entity_type: "machine", entity_id: machineId, event_type: "capability_violation",
        actor_id: userId, actor_type: "user",
        description: `BLOCKED: ${machine.name} cannot ${process} ${barCode}.`,
        metadata: { machineId, machineName: machine.name, barCode, process, requestedQty: qty || 1 },
      });
      return { response: json({ error: `Capability violation: ${machine.name} is not configured to ${process} ${barCode}.` }, 403) };
    }

    const requestedQty = qty || 1;
    if (requestedQty > capability.max_bars) {
      events.push({
        entity_type: "machine", entity_id: machineId, event_type: "capability_violation",
        actor_id: userId, actor_type: "user",
        description: `BLOCKED: max ${capability.max_bars} bars for ${barCode}, requested ${requestedQty}.`,
        metadata: { machineId, barCode, process, requestedQty, maxBars: capability.max_bars },
      });
      return { response: json({ error: `Capacity exceeded: max ${capability.max_bars} × ${barCode} (requested ${requestedQty}).` }, 403) };
    }
  }

  // Create the run
  const runRow: Record<string, unknown> = {
    company_id: machine.company_id, machine_id: machineId, process,
    status: "running", started_at: now,
    operator_profile_id: machine.current_operator_profile_id, created_by: userId,
  };
  if (workOrderId) runRow.work_order_id = workOrderId;
  if (notes) runRow.notes = notes;
  if (qty) runRow.input_qty = qty;

  const { data: newRun, error: runError } = await supabaseUser
    .from("machine_runs").insert(runRow).select().single();
  if (runError) throw runError;

  const machineUpdate: Record<string, unknown> = {
    current_run_id: newRun.id, status: "running", last_event_at: now,
    cut_session_status: "running", machine_lock: true, job_assigned_by: assignedBy || "manual",
  };
  if (cutPlanItemId) machineUpdate.active_job_id = cutPlanItemId;
  if (cutPlanId) machineUpdate.active_plan_id = cutPlanId;

  const { error: mErr } = await supabaseUser.from("machines").update(machineUpdate).eq("id", machineId);
  if (mErr) throw mErr;

  events.push(
    {
      entity_type: "machine_run", entity_id: newRun.id, event_type: "machine_run_started",
      actor_id: userId, actor_type: "user",
      description: `Run started: ${process}${barCode ? ` ${barCode}` : ""} on ${machine.name}`,
      metadata: {
        machineRunId: newRun.id, machineId, process, barCode: barCode || null, qty: qty || null,
        status: "running", startedAt: now, cutPlanItemId: cutPlanItemId || null,
        cutPlanId: cutPlanId || null, assignedBy: assignedBy || "manual",
      },
    },
    {
      entity_type: "machine", entity_id: machineId, event_type: "machine_status_changed",
      actor_id: userId, actor_type: "user",
      description: `Machine ${machine.name}: ${machine.status} → running`,
      metadata: { machineId, oldStatus: machine.status, newStatus: "running" },
    }
  );

  await logProductionEvent(supabaseService, machine.company_id, "cutter_job_assigned", {
    machineId, machineName: machine.name, cutPlanItemId, cutPlanId, assignedBy: assignedBy || "manual",
  }, `Job assigned to ${machine.name}`, machineId, userId);

  await logProductionEvent(supabaseService, machine.company_id, "cutter_started", {
    machineId, machineName: machine.name, machineRunId: newRun.id, barCode, qty,
  }, `Cutter started on ${machine.name}`, machineId, userId);

  return { machineRunId: newRun.id };
}

// ═══════════════════════════════════════════════════════════
// HANDLER: start-queued-run
// ═══════════════════════════════════════════════════════════

async function handleStartQueuedRun(ctx: ActionContext): Promise<{ response?: Response; machineRunId?: string }> {
  const { body, machine, machineId, userId, supabaseUser, supabaseService, events, now } = ctx;
  const { runId, barCode, qty } = body;

  if (!runId) return { response: json({ error: "Missing runId for start-queued-run" }, 400) };

  if (machine.current_run_id) {
    const { data: existingRun } = await supabaseService
      .from("machine_runs").select("id, status, started_at")
      .eq("id", machine.current_run_id).maybeSingle();

    const isOrphan = !existingRun;
    const isInactive = existingRun && ["paused", "completed", "canceled", "rejected"].includes(existingRun.status);

    // Idempotency: if existing run is <5s old and still running, treat as double-tap and return it
    const ageMs = existingRun?.started_at ? Date.now() - new Date(existingRun.started_at).getTime() : Infinity;
    if (existingRun && existingRun.status === "running" && ageMs < 5000) {
      console.warn(`[startQueuedRun] Double-tap detected (<5s) on ${machine.name}, returning existing run ${existingRun.id}`);
      return { machineRunId: existingRun.id };
    }

    if (isOrphan || isInactive) {
      const reason = isOrphan ? "orphan" : `inactive (${existingRun!.status})`;
      console.warn(`[startQueuedRun] Auto-recovering ${reason} run ${machine.current_run_id}`);
      if (existingRun && !["completed", "canceled", "rejected"].includes(existingRun.status)) {
        await supabaseService.from("machine_runs")
          .update({ status: "canceled", ended_at: now, notes: `Auto-canceled: ${reason} run recovery` })
          .eq("id", machine.current_run_id);
      }
      await supabaseService.from("machines").update({
        current_run_id: null, active_job_id: null, active_plan_id: null,
        cut_session_status: "idle", machine_lock: false, job_assigned_by: null,
        status: "idle", last_event_at: now,
      }).eq("id", machineId);

      await logProductionEvent(supabaseService, machine.company_id, "stale_run_auto_recovered", {
        machineId, machineName: machine.name, staleRunId: machine.current_run_id, isOrphan, isInactive, reason,
      }, `Auto-recovered ${reason} run on ${machine.name}`, machineId, userId);

      machine.current_run_id = null;
    } else {
      return { response: json({ error: "Machine already has an active run" }, 400) };
    }
  }

  const { data: queuedRun, error: qrErr } = await supabaseUser
    .from("machine_runs").select("*").eq("id", runId).eq("machine_id", machineId).eq("status", "queued").single();
  if (qrErr || !queuedRun) return { response: json({ error: "Queued run not found or already started" }, 404) };

  if (barCode) {
    const { data: rebarSize } = await supabaseService
      .from("rebar_sizes").select("bar_code").eq("bar_code", barCode).single();
    if (!rebarSize) return { response: json({ error: `Invalid bar_code: ${barCode}` }, 400) };

    const { data: capability } = await supabaseService
      .from("machine_capabilities").select("bar_code, process, max_bars")
      .eq("machine_id", machineId).eq("bar_code", barCode).eq("process", queuedRun.process).maybeSingle();

    if (!capability) {
      events.push({
        entity_type: "machine", entity_id: machineId, event_type: "capability_violation",
        actor_id: userId, actor_type: "user",
        description: `BLOCKED: ${machine.name} cannot ${queuedRun.process} ${barCode}.`,
        metadata: { machineId, barCode, process: queuedRun.process },
      });
      return { response: json({ error: `Capability violation: ${machine.name} cannot ${queuedRun.process} ${barCode}` }, 403) };
    }

    const requestedQty = qty || queuedRun.input_qty || 1;
    if (requestedQty > capability.max_bars) {
      events.push({
        entity_type: "machine", entity_id: machineId, event_type: "capability_violation",
        actor_id: userId, actor_type: "user",
        description: `BLOCKED: qty ${requestedQty} exceeds max ${capability.max_bars} for ${barCode}`,
        metadata: { machineId, barCode, requestedQty, maxBars: capability.max_bars },
      });
      return { response: json({ error: `Capacity exceeded: max ${capability.max_bars} bars for ${barCode}` }, 403) };
    }
  }

  const { error: updateRunErr } = await supabaseUser
    .from("machine_runs").update({ status: "running", started_at: now }).eq("id", runId);
  if (updateRunErr) throw updateRunErr;

  const { error: updateMachineErr } = await supabaseUser
    .from("machines").update({
      current_run_id: runId, status: "running", last_event_at: now,
      cut_session_status: "running", machine_lock: true,
    }).eq("id", machineId);
  if (updateMachineErr) throw updateMachineErr;

  events.push(
    {
      entity_type: "machine_run", entity_id: runId, event_type: "machine_run_started",
      actor_id: userId, actor_type: "user",
      description: `Queued run started: ${queuedRun.process} on ${machine.name}`,
      metadata: { machineRunId: runId, machineId, process: queuedRun.process, barCode: barCode || null, startedAt: now },
    },
    {
      entity_type: "machine", entity_id: machineId, event_type: "machine_status_changed",
      actor_id: userId, actor_type: "user",
      description: `Machine ${machine.name}: ${machine.status} → running`,
      metadata: { machineId, oldStatus: machine.status, newStatus: "running" },
    }
  );

  return { machineRunId: runId };
}

// ═══════════════════════════════════════════════════════════
// HANDLER: pause-run / block-run / complete-run
// ═══════════════════════════════════════════════════════════

async function handlePauseBlockComplete(ctx: ActionContext, action: string): Promise<Response | null> {
  const { body, machine, machineId, userId, supabaseUser, supabaseService, events, now } = ctx;

  if (!machine.current_run_id) {
    if (action === "complete-run") {
      await supabaseUser.from("machines").update({
        active_job_id: null, active_plan_id: null,
        cut_session_status: "idle", machine_lock: false,
      }).eq("id", machineId);
      return json({ success: true, action, warning: "no_active_run" });
    }
    return json({ error: "No active run on this machine" }, 400);
  }

  const runStatusMap: Record<string, string> = {
    "pause-run": "paused", "block-run": "blocked", "complete-run": "completed",
  };
  const machineStatusMap: Record<string, string> = {
    "pause-run": "idle", "block-run": "blocked", "complete-run": "idle",
  };

  const newRunStatus = runStatusMap[action];
  const newMachineStatus = machineStatusMap[action];
  const isCompleting = action === "complete-run";
  const isPausing = action === "pause-run";

  const runUpdate: Record<string, unknown> = { status: newRunStatus };
  if (isCompleting) {
    runUpdate.ended_at = now;
    if (body.outputQty !== undefined) runUpdate.output_qty = body.outputQty;
    if (body.scrapQty !== undefined) runUpdate.scrap_qty = body.scrapQty;
    if (body.notes !== undefined) runUpdate.notes = body.notes;
  }

  const { data: updatedRun, error: runErr } = await supabaseUser
    .from("machine_runs").update(runUpdate).eq("id", machine.current_run_id).select().single();
  if (runErr) throw runErr;

  const machineUpdate: Record<string, unknown> = { status: newMachineStatus, last_event_at: now };
  if (isCompleting) {
    machineUpdate.current_run_id = null;
    machineUpdate.active_job_id = null;
    machineUpdate.active_plan_id = null;
    machineUpdate.cut_session_status = "idle";
    machineUpdate.machine_lock = false;
    machineUpdate.job_assigned_by = null;
  } else if (isPausing) {
    machineUpdate.cut_session_status = "paused";
  }

  const { error: mErr } = await supabaseUser.from("machines").update(machineUpdate).eq("id", machineId);
  if (mErr) throw mErr;

  // Create cut_batch on completion
  if (isCompleting) {
    const { cutPlanItemId, cutPlanId, plannedQty, remnantLengthMm, remnantBarCode } = body;
    const actualQty = body.outputQty ?? 0;
    const scrapQty = body.scrapQty ?? 0;

    if (cutPlanItemId || plannedQty !== undefined) {
      try {
        const batchRow: Record<string, unknown> = {
          company_id: machine.company_id, machine_id: machineId,
          machine_run_id: machine.current_run_id, cut_plan_item_id: cutPlanItemId || null,
          source_plan_id: cutPlanId || null, bar_code: remnantBarCode || updatedRun.process || null,
          planned_qty: plannedQty ?? actualQty, actual_qty: actualQty, scrap_qty: scrapQty,
          status: "completed", created_by: userId,
        };

        const { data: newBatch, error: batchErr } = await supabaseService
          .from("cut_batches").insert(batchRow).select().single();
        if (batchErr) {
          console.error("Failed to create cut_batch:", batchErr);
        } else {
          await logProductionEvent(supabaseService, machine.company_id, "cut_batch_created", {
            batchId: newBatch.id, machineId, machineName: machine.name,
            plannedQty: batchRow.planned_qty, actualQty, scrapQty,
            variance: actualQty - (plannedQty ?? actualQty), cutPlanItemId,
          }, `Cut batch created on ${machine.name}`, machineId, userId);

          const variance = actualQty - (plannedQty ?? actualQty);
          if (variance !== 0) {
            await logProductionEvent(supabaseService, machine.company_id, "variance_detected", {
              batchId: newBatch.id, machineId, machineName: machine.name,
              plannedQty: plannedQty ?? actualQty, actualQty, variance, cutPlanItemId,
            }, `Variance on ${machine.name}: planned ${plannedQty ?? actualQty}, actual ${actualQty}, diff ${variance}`,
            machineId, userId);
          }

          if (remnantLengthMm && remnantLengthMm >= 300 && remnantBarCode) {
            try {
              await supabaseService.from("waste_bank_pieces").insert({
                company_id: machine.company_id, bar_code: remnantBarCode,
                length_mm: remnantLengthMm, quantity: 1,
                source_job_id: cutPlanItemId || null, source_batch_id: newBatch.id,
                source_machine_id: machineId, status: "available", location: machine.name,
              });
            } catch (wErr) {
              console.error("Failed to create waste bank piece:", wErr);
            }
          }
        }
      } catch (batchError) {
        console.error("cut_batch creation error:", batchError);
      }
    }

    await logProductionEvent(supabaseService, machine.company_id, "cutter_completed", {
      machineId, machineName: machine.name, machineRunId: machine.current_run_id,
      outputQty: actualQty, scrapQty, cutPlanItemId: body.cutPlanItemId,
    }, `Cutter completed on ${machine.name}: ${actualQty} pieces`, machineId, userId);
  }

  if (isPausing) {
    await logProductionEvent(supabaseService, machine.company_id, "cutter_paused", {
      machineId, machineName: machine.name, machineRunId: machine.current_run_id,
      activeJobId: machine.active_job_id,
    }, `Cutter paused on ${machine.name}`, machineId, userId);
  }

  events.push(
    {
      entity_type: "machine_run", entity_id: updatedRun.id, event_type: "machine_run_updated",
      actor_id: userId, actor_type: "user",
      description: `Run ${newRunStatus}: ${updatedRun.process} on ${machine.name}`,
      metadata: {
        machineRunId: updatedRun.id, machineId, status: newRunStatus, process: updatedRun.process,
        startedAt: updatedRun.started_at, endedAt: updatedRun.ended_at,
        inputQty: updatedRun.input_qty, outputQty: updatedRun.output_qty, scrapQty: updatedRun.scrap_qty,
      },
    },
    {
      entity_type: "machine", entity_id: machineId, event_type: "machine_status_changed",
      actor_id: userId, actor_type: "user",
      description: `Machine ${machine.name}: ${machine.status} → ${newMachineStatus}`,
      metadata: { machineId, oldStatus: machine.status, newStatus: newMachineStatus },
    }
  );

  return null;
}

// ═══════════════════════════════════════════════════════════
// HANDLER: supervisor-unlock
// ═══════════════════════════════════════════════════════════

async function handleSupervisorUnlock(ctx: ActionContext): Promise<Response | null> {
  const { body, machine, machineId, userId, roles, supabaseService, events, now } = ctx;

  const isSupervisor = roles.some((r: string) => ["admin", "shop_supervisor"].includes(r));
  if (!isSupervisor) {
    return json({ error: "Forbidden: only admin or shop_supervisor can force-unlock" }, 403);
  }

  const reason = body.notes || "No reason provided";

  if (machine.current_run_id) {
    await supabaseService
      .from("machine_runs")
      .update({ status: "canceled", ended_at: now, notes: `Force-unlocked: ${reason}` })
      .eq("id", machine.current_run_id);
  }

  const { error: unlockErr } = await supabaseService
    .from("machines")
    .update({
      current_run_id: null, active_job_id: null, active_plan_id: null,
      cut_session_status: "idle", machine_lock: false, job_assigned_by: null,
      status: "idle", last_event_at: now,
    })
    .eq("id", machineId);
  if (unlockErr) throw unlockErr;

  await logProductionEvent(supabaseService, machine.company_id, "supervisor_override", {
    machineId, machineName: machine.name, previousRunId: machine.current_run_id,
    previousJobId: machine.active_job_id, previousLock: machine.machine_lock, reason,
  }, `Supervisor force-unlocked ${machine.name}: ${reason}`, machineId, userId);

  events.push({
    entity_type: "machine", entity_id: machineId, event_type: "supervisor_override",
    actor_id: userId, actor_type: "user",
    description: `Supervisor force-unlocked ${machine.name}: ${reason}`,
    metadata: { machineId, machineName: machine.name, reason,
      previousRunId: machine.current_run_id, previousJobId: machine.active_job_id },
  });

  return null;
}

// ═══════════════════════════════════════════════════════════
// MAIN ROUTER
// ═══════════════════════════════════════════════════════════

Deno.serve((req) =>
  handleRequest(req, async (ctx) => {
    const { userId, serviceClient: supabaseService, userClient: supabaseUser, body: rawBody, req: rawReq } = ctx;

    // ── Role check (get roles for ActionContext) ──
    const { data: userRoles } = await supabaseService.from("user_roles").select("role").eq("user_id", userId);
    const roles = (userRoles || []).map((r: { role: string }) => r.role);

    // ── Parse body with Zod ──
    const topSchema = z.object({
      action: z.string().min(1).max(50),
      machineId: z.string().uuid("machineId must be a valid UUID"),
    }).passthrough();
    const parsed = topSchema.safeParse(rawBody);
    if (!parsed.success) {
      return json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, 400);
    }
    const body = parsed.data;
    const { action, machineId } = body;

    const { data: machine, error: machineError } = await supabaseUser!
      .from("machines").select("*").eq("id", machineId).single();
    if (machineError || !machine) return json({ error: "Machine not found or access denied" }, 404);

    const now = new Date().toISOString();
    const events: Record<string, unknown>[] = [];
    let machineRunId: string | null = null;

    const actionCtx: ActionContext = {
      userId, machineId, machine, body, roles,
      supabaseUser: supabaseUser!, supabaseService, events, now,
    };

    switch (action) {
      case "update-status": {
        const resp = await handleUpdateStatus(actionCtx);
        if (resp) return resp;
        break;
      }
      case "assign-operator": {
        const resp = await handleAssignOperator(actionCtx);
        if (resp) return resp;
        break;
      }
      case "start-run": {
        const result = await handleStartRun(actionCtx);
        if (result.response) return result.response;
        machineRunId = result.machineRunId || null;
        break;
      }
      case "start-queued-run": {
        const result = await handleStartQueuedRun(actionCtx);
        if (result.response) return result.response;
        machineRunId = result.machineRunId || null;
        break;
      }
      case "pause-run":
      case "block-run":
      case "complete-run": {
        const resp = await handlePauseBlockComplete(actionCtx, action);
        if (resp) return resp;
        break;
      }
      case "supervisor-unlock": {
        const resp = await handleSupervisorUnlock(actionCtx);
        if (resp) return resp;
        break;
      }
      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }

    // ── Write events ──
    await flushEvents(supabaseService, events, machine.company_id);

    return json({ success: true, machineId, action, machineRunId: machineRunId ?? undefined });
  }, { functionName: "manage-machine", requireAnyRole: ["admin", "workshop"], requireCompany: false, wrapResult: false })
);
