import { json, logProductionEvent, type ActionContext } from "../lib/helpers.ts";

/** Handles pause-run, block-run, and complete-run actions */
export async function handlePauseBlockComplete(ctx: ActionContext, action: string): Promise<Response | null> {
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

  // ── Create cut_batch on completion ──
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
