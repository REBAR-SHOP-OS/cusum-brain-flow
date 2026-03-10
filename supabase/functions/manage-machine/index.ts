import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Helper to log a production event */
async function logProductionEvent(
  supabaseService: any,
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

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    // ── Auth ──────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseService = createClient(supabaseUrl, serviceKey);

    // Validate JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return json({ error: "Invalid token" }, 401);
    }
    const userId = claimsData.claims.sub as string;

    // ── Role check: block office-only users ──────────────────────────
    const { data: userRoles } = await supabaseService
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const roles = (userRoles || []).map((r: { role: string }) => r.role);
    const hasWriteRole = roles.some((r: string) =>
      ["admin", "workshop"].includes(r)
    );
    if (!hasWriteRole) {
      return json({ error: "Forbidden: insufficient role" }, 403);
    }

    // ── Parse body ───────────────────────────────────────────────────
    const topSchema = z.object({
      action: z.string().min(1).max(50),
      machineId: z.string().uuid("machineId must be a valid UUID"),
    }).passthrough();
    const parsed = topSchema.safeParse(await req.json());
    if (!parsed.success) {
      return json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, 400);
    }
    const body = parsed.data;
    const { action, machineId } = body;

    // Fetch current machine state (via user client → RLS enforced)
    const { data: machine, error: machineError } = await supabaseUser
      .from("machines")
      .select("*")
      .eq("id", machineId)
      .single();

    if (machineError || !machine) {
      return json({ error: "Machine not found or access denied" }, 404);
    }

    const now = new Date().toISOString();
    const events: Record<string, unknown>[] = [];
    let machineRunId: string | null = null;

    // ── Action handlers ──────────────────────────────────────────────
    switch (action) {
      // ─── Update machine status ─────────────────────────────────────
      case "update-status": {
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
        break;
      }

      // ─── Assign operator ───────────────────────────────────────────
      case "assign-operator": {
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
        break;
      }

      // ─── Start run (with capability validation + job lock) ─────────
      case "start-run": {
        const { process, workOrderId, notes, barCode, qty, cutPlanItemId, cutPlanId, assignedBy } = body;
        const validProcesses = [
          "cut", "bend", "load", "pickup", "delivery", "clearance", "other",
        ];
        if (!validProcesses.includes(process)) {
          return json({ error: `Invalid process: ${process}` }, 400);
        }
        if (machine.current_run_id) {
          return json({ error: "Machine already has an active run" }, 400);
        }

        // ── HARD JOB LOCK CHECK ──────────────────────────────────────
        if (
          machine.cut_session_status === "running" &&
          machine.active_job_id &&
          cutPlanItemId &&
          machine.active_job_id !== cutPlanItemId
        ) {
          // Log the blocked attempt
          await logProductionEvent(
            supabaseService, machine.company_id,
            "cutter_switch_blocked",
            {
              machineId, machineName: machine.name,
              activeJobId: machine.active_job_id,
              attemptedJobId: cutPlanItemId,
              assignedBy: machine.job_assigned_by,
            },
            `BLOCKED: Job switch on ${machine.name} while running. Active: ${machine.active_job_id}, Attempted: ${cutPlanItemId}`,
            machineId, userId
          );
          return json({
            error: `Machine ${machine.name} is locked to active job. Complete or pause current job first.`,
            lockedJobId: machine.active_job_id,
          }, 403);
        }

        // ── CAPABILITY VALIDATION (hard rule) ────────────────────────
        if (barCode) {
          const { data: rebarSize, error: rebarErr } = await supabaseService
            .from("rebar_sizes")
            .select("bar_code, diameter_mm")
            .eq("bar_code", barCode)
            .single();

          if (rebarErr || !rebarSize) {
            return json({
              error: `Invalid bar_code: ${barCode}. Must be a valid RSIC Canada size (10M–55M).`,
            }, 400);
          }

          const { data: capability, error: capErr } = await supabaseService
            .from("machine_capabilities")
            .select("bar_code, process, max_bars")
            .eq("machine_id", machineId)
            .eq("bar_code", barCode)
            .eq("process", process)
            .maybeSingle();

          if (capErr) {
            console.error("Capability check error:", capErr);
          }

          if (!capability) {
            events.push({
              entity_type: "machine",
              entity_id: machineId,
              event_type: "capability_violation",
              actor_id: userId,
              actor_type: "user",
              description: `BLOCKED: ${machine.name} cannot ${process} ${barCode}. No matching capability.`,
              metadata: {
                machineId, machineName: machine.name, model: machine.model,
                barCode, process, requestedQty: qty || 1,
              },
            });
            if (events.length > 0) {
              const { error: evtErr } = await supabaseService
                .from("activity_events")
                .insert(events.map((e: any) => ({ ...e, source: "system", company_id: machine.company_id })));
              if (evtErr) console.error("Failed to log events:", evtErr);
            }
            return json({
              error: `Capability violation: ${machine.name} is not configured to ${process} ${barCode}. Check machine_capabilities.`,
              violation: { machineId, machineName: machine.name, barCode, process, requestedQty: qty || 1 },
            }, 403);
          }

          const requestedQty = qty || 1;
          if (requestedQty > capability.max_bars) {
            events.push({
              entity_type: "machine",
              entity_id: machineId,
              event_type: "capability_violation",
              actor_id: userId,
              actor_type: "user",
              description: `BLOCKED: ${machine.name} max ${capability.max_bars} bars for ${barCode} ${process}, requested ${requestedQty}.`,
              metadata: { machineId, machineName: machine.name, barCode, process, requestedQty, maxBars: capability.max_bars },
            });
            if (events.length > 0) {
              const { error: evtErr } = await supabaseService
                .from("activity_events")
                .insert(events.map((e: any) => ({ ...e, source: "system", company_id: machine.company_id })));
              if (evtErr) console.error("Failed to log events:", evtErr);
            }
            return json({
              error: `Capacity exceeded: ${machine.name} can ${process} max ${capability.max_bars} × ${barCode} at once (requested ${requestedQty}).`,
              violation: { machineId, barCode, process, requestedQty, maxBars: capability.max_bars },
            }, 403);
          }
        }

        // ── Create the run ───────────────────────────────────────────
        const runRow: Record<string, unknown> = {
          company_id: machine.company_id,
          machine_id: machineId,
          process,
          status: "running",
          started_at: now,
          operator_profile_id: machine.current_operator_profile_id,
          created_by: userId,
        };
        if (workOrderId) runRow.work_order_id = workOrderId;
        if (notes) runRow.notes = notes;
        if (qty) runRow.input_qty = qty;

        const { data: newRun, error: runError } = await supabaseUser
          .from("machine_runs")
          .insert(runRow)
          .select()
          .single();
        if (runError) throw runError;
        machineRunId = newRun.id;

        // ── Set lock columns on machine ──────────────────────────────
        const machineUpdate: Record<string, unknown> = {
          current_run_id: newRun.id,
          status: "running",
          last_event_at: now,
          cut_session_status: "running",
          machine_lock: true,
          job_assigned_by: assignedBy || "manual",
        };
        if (cutPlanItemId) machineUpdate.active_job_id = cutPlanItemId;
        if (cutPlanId) machineUpdate.active_plan_id = cutPlanId;

        const { error: mErr } = await supabaseUser
          .from("machines")
          .update(machineUpdate)
          .eq("id", machineId);
        if (mErr) throw mErr;

        events.push(
          {
            entity_type: "machine_run",
            entity_id: newRun.id,
            event_type: "machine_run_started",
            actor_id: userId,
            actor_type: "user",
            description: `Run started: ${process}${barCode ? ` ${barCode}` : ""} on ${machine.name}`,
            metadata: {
              machineRunId: newRun.id, machineId, process,
              barCode: barCode || null, qty: qty || null,
              status: "running", startedAt: now,
              cutPlanItemId: cutPlanItemId || null,
              cutPlanId: cutPlanId || null,
              assignedBy: assignedBy || "manual",
            },
          },
          {
            entity_type: "machine",
            entity_id: machineId,
            event_type: "machine_status_changed",
            actor_id: userId,
            actor_type: "user",
            description: `Machine ${machine.name}: ${machine.status} → running`,
            metadata: { machineId, oldStatus: machine.status, newStatus: "running" },
          }
        );

        // ── Log production events ────────────────────────────────────
        await logProductionEvent(supabaseService, machine.company_id, "cutter_job_assigned", {
          machineId, machineName: machine.name, cutPlanItemId, cutPlanId, assignedBy: assignedBy || "manual",
        }, `Job assigned to ${machine.name}`, machineId, userId);

        await logProductionEvent(supabaseService, machine.company_id, "cutter_started", {
          machineId, machineName: machine.name, machineRunId: newRun.id, barCode, qty,
        }, `Cutter started on ${machine.name}`, machineId, userId);

        break;
      }

      // ─── Start a queued run ────────────────────────────────────────
      case "start-queued-run": {
        const { runId, barCode, qty } = body;
        if (!runId) {
          return json({ error: "Missing runId for start-queued-run" }, 400);
        }
        if (machine.current_run_id) {
          return json({ error: "Machine already has an active run" }, 400);
        }

        const { data: queuedRun, error: qrErr } = await supabaseUser
          .from("machine_runs")
          .select("*")
          .eq("id", runId)
          .eq("machine_id", machineId)
          .eq("status", "queued")
          .single();

        if (qrErr || !queuedRun) {
          return json({ error: "Queued run not found or already started" }, 404);
        }

        if (barCode) {
          const { data: rebarSize } = await supabaseService
            .from("rebar_sizes")
            .select("bar_code")
            .eq("bar_code", barCode)
            .single();

          if (!rebarSize) {
            return json({ error: `Invalid bar_code: ${barCode}` }, 400);
          }

          const { data: capability } = await supabaseService
            .from("machine_capabilities")
            .select("bar_code, process, max_bars")
            .eq("machine_id", machineId)
            .eq("bar_code", barCode)
            .eq("process", queuedRun.process)
            .maybeSingle();

          if (!capability) {
            events.push({
              entity_type: "machine",
              entity_id: machineId,
              event_type: "capability_violation",
              actor_id: userId,
              actor_type: "user",
              description: `BLOCKED: ${machine.name} cannot ${queuedRun.process} ${barCode}.`,
              metadata: { machineId, barCode, process: queuedRun.process },
            });
            if (events.length > 0) {
              try {
                await supabaseService.from("activity_events").insert(events.map((e: any) => ({ ...e, source: "system", company_id: machine.company_id })));
              } catch (evtErr) { console.error("Failed to log events:", evtErr); }
            }
            return json({ error: `Capability violation: ${machine.name} cannot ${queuedRun.process} ${barCode}` }, 403);
          }

          const requestedQty = qty || queuedRun.input_qty || 1;
          if (requestedQty > capability.max_bars) {
            events.push({
              entity_type: "machine",
              entity_id: machineId,
              event_type: "capability_violation",
              actor_id: userId,
              actor_type: "user",
              description: `BLOCKED: qty ${requestedQty} exceeds max ${capability.max_bars} for ${barCode}`,
              metadata: { machineId, barCode, requestedQty, maxBars: capability.max_bars },
            });
            if (events.length > 0) {
              try {
                await supabaseService.from("activity_events").insert(events.map((e: any) => ({ ...e, source: "system", company_id: machine.company_id })));
              } catch (evtErr) { console.error("Failed to log events:", evtErr); }
            }
            return json({ error: `Capacity exceeded: max ${capability.max_bars} bars for ${barCode}` }, 403);
          }
        }

        const { error: updateRunErr } = await supabaseUser
          .from("machine_runs")
          .update({ status: "running", started_at: now })
          .eq("id", runId);
        if (updateRunErr) throw updateRunErr;
        machineRunId = runId;

        const { error: updateMachineErr } = await supabaseUser
          .from("machines")
          .update({
            current_run_id: runId, status: "running", last_event_at: now,
            cut_session_status: "running", machine_lock: true,
          })
          .eq("id", machineId);
        if (updateMachineErr) throw updateMachineErr;

        events.push(
          {
            entity_type: "machine_run",
            entity_id: runId,
            event_type: "machine_run_started",
            actor_id: userId,
            actor_type: "user",
            description: `Queued run started: ${queuedRun.process} on ${machine.name}`,
            metadata: {
              machineRunId: runId, machineId, process: queuedRun.process,
              barCode: barCode || null, startedAt: now,
            },
          },
          {
            entity_type: "machine",
            entity_id: machineId,
            event_type: "machine_status_changed",
            actor_id: userId,
            actor_type: "user",
            description: `Machine ${machine.name}: ${machine.status} → running`,
            metadata: { machineId, oldStatus: machine.status, newStatus: "running" },
          }
        );
        break;
      }

      // ─── Pause / Block / Complete run ──────────────────────────────
      case "pause-run":
      case "block-run":
      case "complete-run": {
        if (!machine.current_run_id) {
          if (action === "complete-run") {
            // Clear lock columns even if no formal run
            await supabaseUser.from("machines").update({
              active_job_id: null, active_plan_id: null,
              cut_session_status: "idle", machine_lock: false,
            }).eq("id", machineId);
            return json({ success: true, action, warning: "no_active_run" });
          }
          return json({ error: "No active run on this machine" }, 400);
        }

        const runStatusMap: Record<string, string> = {
          "pause-run": "paused",
          "block-run": "blocked",
          "complete-run": "completed",
        };
        const machineStatusMap: Record<string, string> = {
          "pause-run": "idle",
          "block-run": "blocked",
          "complete-run": "idle",
        };

        const newRunStatus = runStatusMap[action];
        const newMachineStatus = machineStatusMap[action];
        const isCompleting = action === "complete-run";
        const isPausing = action === "pause-run";

        // Update machine_runs row
        const runUpdate: Record<string, unknown> = { status: newRunStatus };
        if (isCompleting) {
          runUpdate.ended_at = now;
          if (body.outputQty !== undefined) runUpdate.output_qty = body.outputQty;
          if (body.scrapQty !== undefined) runUpdate.scrap_qty = body.scrapQty;
          if (body.notes !== undefined) runUpdate.notes = body.notes;
        }

        const { data: updatedRun, error: runErr } = await supabaseUser
          .from("machine_runs")
          .update(runUpdate)
          .eq("id", machine.current_run_id)
          .select()
          .single();
        if (runErr) throw runErr;

        // ── Update machine with lock state ───────────────────────────
        const machineUpdate: Record<string, unknown> = {
          status: newMachineStatus,
          last_event_at: now,
        };

        if (isCompleting) {
          // Clear all lock columns on completion
          machineUpdate.current_run_id = null;
          machineUpdate.active_job_id = null;
          machineUpdate.active_plan_id = null;
          machineUpdate.cut_session_status = "idle";
          machineUpdate.machine_lock = false;
          machineUpdate.job_assigned_by = null;
        } else if (isPausing) {
          // Paused: keep active_job_id but update status
          machineUpdate.cut_session_status = "paused";
          // Keep machine_lock true and active_job_id intact
        }

        const { error: mErr } = await supabaseUser
          .from("machines")
          .update(machineUpdate)
          .eq("id", machineId);
        if (mErr) throw mErr;

        // ── Create cut_batch on completion ────────────────────────────
        if (isCompleting) {
          const { cutPlanItemId, cutPlanId, plannedQty, remnantLengthMm, remnantBarCode } = body;
          const actualQty = body.outputQty ?? 0;
          const scrapQty = body.scrapQty ?? 0;

          // Create cut_batch record
          if (cutPlanItemId || plannedQty !== undefined) {
            try {
              const batchRow: Record<string, unknown> = {
                company_id: machine.company_id,
                machine_id: machineId,
                machine_run_id: machine.current_run_id,
                cut_plan_item_id: cutPlanItemId || null,
                source_plan_id: cutPlanId || null,
                bar_code: remnantBarCode || updatedRun.process || null,
                planned_qty: plannedQty ?? actualQty,
                actual_qty: actualQty,
                scrap_qty: scrapQty,
                status: "completed",
                created_by: userId,
              };

              const { data: newBatch, error: batchErr } = await supabaseService
                .from("cut_batches")
                .insert(batchRow)
                .select()
                .single();

              if (batchErr) {
                console.error("Failed to create cut_batch:", batchErr);
              } else {
                // Log cut_batch_created production event
                await logProductionEvent(supabaseService, machine.company_id, "cut_batch_created", {
                  batchId: newBatch.id, machineId, machineName: machine.name,
                  plannedQty: batchRow.planned_qty, actualQty, scrapQty,
                  variance: actualQty - (plannedQty ?? actualQty),
                  cutPlanItemId,
                }, `Cut batch created on ${machine.name}`, machineId, userId);

                // Log variance if detected
                const variance = actualQty - (plannedQty ?? actualQty);
                if (variance !== 0) {
                  await logProductionEvent(supabaseService, machine.company_id, "variance_detected", {
                    batchId: newBatch.id, machineId, machineName: machine.name,
                    plannedQty: plannedQty ?? actualQty, actualQty, variance,
                    cutPlanItemId,
                  }, `Variance detected on ${machine.name}: planned ${plannedQty ?? actualQty}, actual ${actualQty}, diff ${variance}`,
                  machineId, userId);
                }

                // ── Generate waste bank piece for remnants ≥ 300mm ───
                if (remnantLengthMm && remnantLengthMm >= 300 && remnantBarCode) {
                  try {
                    await supabaseService.from("waste_bank_pieces").insert({
                      company_id: machine.company_id,
                      bar_code: remnantBarCode,
                      length_mm: remnantLengthMm,
                      quantity: 1,
                      source_job_id: cutPlanItemId || null,
                      source_batch_id: newBatch.id,
                      source_machine_id: machineId,
                      status: "available",
                      location: machine.name,
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

          // Log cutter_completed production event
          await logProductionEvent(supabaseService, machine.company_id, "cutter_completed", {
            machineId, machineName: machine.name, machineRunId: machine.current_run_id,
            outputQty: actualQty, scrapQty, cutPlanItemId,
          }, `Cutter completed on ${machine.name}: ${actualQty} pieces`, machineId, userId);
        }

        // Log cutter_paused production event
        if (isPausing) {
          await logProductionEvent(supabaseService, machine.company_id, "cutter_paused", {
            machineId, machineName: machine.name, machineRunId: machine.current_run_id,
            activeJobId: machine.active_job_id,
          }, `Cutter paused on ${machine.name}`, machineId, userId);
        }

        events.push(
          {
            entity_type: "machine_run",
            entity_id: updatedRun.id,
            event_type: "machine_run_updated",
            actor_id: userId,
            actor_type: "user",
            description: `Run ${newRunStatus}: ${updatedRun.process} on ${machine.name}`,
            metadata: {
              machineRunId: updatedRun.id, machineId,
              status: newRunStatus, process: updatedRun.process,
              startedAt: updatedRun.started_at, endedAt: updatedRun.ended_at,
              inputQty: updatedRun.input_qty, outputQty: updatedRun.output_qty,
              scrapQty: updatedRun.scrap_qty,
            },
          },
          {
            entity_type: "machine",
            entity_id: machineId,
            event_type: "machine_status_changed",
            actor_id: userId,
            actor_type: "user",
            description: `Machine ${machine.name}: ${machine.status} → ${newMachineStatus}`,
            metadata: { machineId, oldStatus: machine.status, newStatus: newMachineStatus },
          }
        );
        break;
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }

    // ── Write events ─────────────────────────────────────────────────
    if (events.length > 0) {
      const { error: evtErr } = await supabaseService
        .from("activity_events")
        .insert(events.map((e: any) => ({ ...e, source: "system", company_id: machine.company_id })));
      if (evtErr) console.error("Failed to log events:", evtErr);
    }

    return json({ success: true, machineId, action, machineRunId: machineRunId ?? undefined });
  } catch (error) {
    console.error("manage-machine error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return json({ error: message }, 500);
  }
});
