import { json, logProductionEvent, type ActionContext } from "../lib/helpers.ts";

export async function handleStartRun(ctx: ActionContext): Promise<{ response?: Response; machineRunId?: string }> {
  const { body, machine, machineId, userId, supabaseUser, supabaseService, events, now } = ctx;
  const { process, workOrderId, notes, barCode, qty, cutPlanItemId, cutPlanId, assignedBy } = body;

  const validProcesses = ["cut", "bend", "load", "pickup", "delivery", "clearance", "other"];
  if (!validProcesses.includes(process)) {
    return { response: json({ error: `Invalid process: ${process}` }, 400) };
  }
  if (machine.current_run_id) {
    return { response: json({ error: "Machine already has an active run" }, 400) };
  }

  // ── HARD JOB LOCK CHECK ──
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

  // ── CUTTER ROUTING ENFORCEMENT ──
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

  // ── CAPABILITY VALIDATION ──
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

  // ── Create the run ──
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
