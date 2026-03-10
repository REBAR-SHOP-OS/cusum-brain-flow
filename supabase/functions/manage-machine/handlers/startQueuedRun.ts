import { json, type ActionContext } from "../lib/helpers.ts";

export async function handleStartQueuedRun(ctx: ActionContext): Promise<{ response?: Response; machineRunId?: string }> {
  const { body, machine, machineId, userId, supabaseUser, supabaseService, events, now } = ctx;
  const { runId, barCode, qty } = body;

  if (!runId) return { response: json({ error: "Missing runId for start-queued-run" }, 400) };
  if (machine.current_run_id) return { response: json({ error: "Machine already has an active run" }, 400) };

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
