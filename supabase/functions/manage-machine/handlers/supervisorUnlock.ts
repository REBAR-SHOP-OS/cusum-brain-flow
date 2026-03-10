import { json, logProductionEvent, type ActionContext } from "../lib/helpers.ts";

export async function handleSupervisorUnlock(ctx: ActionContext): Promise<Response | null> {
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
