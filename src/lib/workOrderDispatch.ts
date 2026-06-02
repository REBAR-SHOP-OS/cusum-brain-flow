import { supabase } from "@/integrations/supabase/client";

/**
 * Work Order ↔ Machine dispatch service.
 *
 * Start  → upserts machine_queue_items for every production_task on the WO,
 *          auto-picking the first IDLE machine whose type matches the task
 *          (cut→cutter, bend→bender, spiral→bender, fallback→any idle).
 *          Sets those queue rows to `running` and tasks to `in_progress`.
 *
 * Pause  → flips matching queue rows back to `queued` (same machine, same
 *          position, qty_completed untouched) and tasks back to `pending`.
 */

type MachineRow = { id: string; type: string; status: string; company_id: string };
type TaskRow = {
  id: string;
  task_type: string | null;
  status: string | null;
  company_id: string;
  setup_key: string | null;
  bar_code: string | null;
  grade: string | null;
  locked_to_machine_id: string | null;
};

/**
 * Setup-key affinity helpers (legacy dispatch path).
 * A "setup key" identifies a unique machine setup — operation + bar size +
 * grade. Cut tasks with the same setup_key should cluster on the same cutter
 * when capacity allows, instead of being scattered round-robin.
 */
function processForTask(taskType: string | null): "cut" | "bend" | null {
  switch ((taskType || "").toLowerCase()) {
    case "cut":
    case "shear":
      return "cut";
    case "bend":
    case "spiral":
      return "bend";
    default:
      return null;
  }
}

function deriveSetupKey(t: Pick<TaskRow, "setup_key" | "task_type" | "bar_code" | "grade">): string | null {
  if (t.setup_key && t.setup_key.trim().length > 0) return t.setup_key.trim();
  const proc = processForTask(t.task_type);
  if (!proc) return null;
  const bar = (t.bar_code || "").trim() || "NA";
  const grade = (t.grade || "").trim() || "NA";
  return `${proc}:${bar}:${grade}`;
}
type WorkOrderRow = {
  id: string;
  status: string | null;
  barlist_id: string | null;
  project_id: string | null;
  order_id: string | null;
};

type HydrationResult = { ok: boolean; eligible: number; inserted: number; reason?: string };

/**
 * Fallback hydration: when a WO has no production_tasks but its barlist has
 * cut_plan_items still in queued/cutting phase, create one production_task per
 * eligible item so the dispatch pipeline has something to assign.
 * Items already in `clearance` or `complete` are intentionally skipped.
 */
async function hydrateTasksFromCutPlanItems(wo: WorkOrderRow): Promise<HydrationResult> {
  if (!wo.barlist_id) {
    return { ok: false, eligible: 0, inserted: 0, reason: "Work order has no barlist" };
  }
  const { data: plans, error: pErr } = await supabase
    .from("cut_plans")
    .select("id, company_id")
    .eq("barlist_id", wo.barlist_id);
  if (pErr) {
    return { ok: false, eligible: 0, inserted: 0, reason: pErr.message };
  }
  const planRows = plans || [];
  if (planRows.length === 0) {
    return { ok: false, eligible: 0, inserted: 0, reason: "Work order has no cut plan" };
  }
  const planIds = planRows.map((p: any) => p.id);
  const companyId = (planRows[0] as any).company_id as string;

  const { data: items, error: iErr } = await supabase
    .from("cut_plan_items")
    .select("id, cut_plan_id, mark_number, bar_code, cut_length_mm, total_pieces, phase, unit_system, drawing_ref")
    .in("cut_plan_id", planIds);
  if (iErr) {
    return { ok: false, eligible: 0, inserted: 0, reason: iErr.message };
  }
  const allItems = items || [];
  if (allItems.length === 0) {
    return { ok: false, eligible: 0, inserted: 0, reason: "Work order has no production items" };
  }
  const eligible = allItems.filter(
    (it: any) =>
      ["queued", "cutting"].includes(String(it.phase || "").toLowerCase()) &&
      Number(it.total_pieces || 0) > 0,
  );
  if (eligible.length === 0) {
    return {
      ok: false,
      eligible: 0,
      inserted: 0,
      reason: "All cuts done — this work order is ready for clearance, not cutting.",
    };
  }

  // Defensive: skip items that already have a production_task on this WO
  const { data: existingTasks } = await supabase
    .from("production_tasks")
    .select("cut_plan_item_id")
    .eq("work_order_id", wo.id);
  const existingIds = new Set((existingTasks || []).map((r: any) => r.cut_plan_item_id).filter(Boolean));

  const rows = eligible
    .filter((it: any) => !existingIds.has(it.id))
    .map((it: any) => ({
      company_id: companyId,
      work_order_id: wo.id,
      project_id: wo.project_id,
      order_id: wo.order_id,
      barlist_id: wo.barlist_id,
      cut_plan_id: it.cut_plan_id,
      cut_plan_item_id: it.id,
      task_type: "cut",
      bar_code: it.bar_code,
      mark_number: it.mark_number,
      drawing_ref: it.drawing_ref ?? null,
      cut_length_mm: it.cut_length_mm,
      unit_system: it.unit_system || "mm",
      qty_required: Number(it.total_pieces || 0),
      qty_completed: 0,
      status: "pending",
      priority: 100,
    }));

  if (rows.length === 0) {
    return { ok: true, eligible: eligible.length, inserted: 0 };
  }
  const { error: insErr } = await supabase.from("production_tasks").insert(rows);
  if (insErr) {
    console.error("[hydrateTasksFromCutPlanItems] insert failed:", insErr.message);
    return { ok: false, eligible: eligible.length, inserted: 0, reason: insErr.message };
  }
  return { ok: true, eligible: eligible.length, inserted: rows.length };
}


function machineTypeForTask(taskType: string | null): string | null {
  switch ((taskType || "").toLowerCase()) {
    case "cut":
    case "shear":
      return "cutter";
    case "bend":
    case "spiral":
      return "bender";
    default:
      return null;
  }
}

export interface DispatchResult {
  ok: boolean;
  assigned: number;
  total: number;
  reason?: string;
}

export async function startWorkOrder(workOrderId: string): Promise<DispatchResult> {
  // 0) Load WO context (needed for status check + hydration fallback)
  const { data: wo, error: woErr } = await supabase
    .from("work_orders")
    .select("id, status, barlist_id, project_id, order_id")
    .eq("id", workOrderId)
    .maybeSingle();
  if (woErr) {
    console.error("[startWorkOrder] load WO failed:", woErr.message);
    return { ok: false, assigned: 0, total: 0, reason: woErr.message };
  }
  if (!wo) {
    return { ok: false, assigned: 0, total: 0, reason: "Work order not found" };
  }
  if (wo.status === "in_progress") {
    console.debug("[startWorkOrder]", { workOrderId, blockedReason: "already_running" });
    return { ok: false, assigned: 0, total: 0, reason: "Work order is already running" };
  }

  // 1) Load tasks for this WO that are dispatchable
  const TASK_COLS =
    "id, task_type, status, company_id, setup_key, bar_code, grade, locked_to_machine_id";
  let { data: tasks, error: tErr } = await supabase
    .from("production_tasks")
    .select(TASK_COLS)
    .eq("work_order_id", workOrderId)
    .in("status", ["pending", "queued", "on_hold", "in_progress"]);

  if (tErr) {
    console.error("[startWorkOrder] load tasks failed:", tErr.message);
    return { ok: false, assigned: 0, total: 0, reason: tErr.message };
  }
  let taskRows = (tasks || []) as TaskRow[];

  // 1b) Hydration fallback — if no production_tasks exist for this WO,
  // create them from cut_plan_items still in queued/cutting phase.
  if (taskRows.length === 0) {
    const hydrated = await hydrateTasksFromCutPlanItems(wo as WorkOrderRow);
    console.debug("[startWorkOrder]", {
      workOrderId,
      barlistId: wo.barlist_id,
      productionTasks: 0,
      eligibleCutItems: hydrated.eligible,
      hydratedInserted: hydrated.inserted,
      blockedReason: hydrated.ok ? null : hydrated.reason,
    });
    if (!hydrated.ok) {
      return { ok: false, assigned: 0, total: 0, reason: hydrated.reason };
    }
    const reloaded = await supabase
      .from("production_tasks")
      .select(TASK_COLS)
      .eq("work_order_id", workOrderId)
      .in("status", ["pending", "queued", "on_hold", "in_progress"]);
    if (reloaded.error) {
      console.error("[startWorkOrder] reload tasks failed:", reloaded.error.message);
      return { ok: false, assigned: 0, total: 0, reason: reloaded.error.message };
    }
    taskRows = (reloaded.data || []) as TaskRow[];
    if (taskRows.length === 0) {
      return { ok: false, assigned: 0, total: 0, reason: "Work order has no production items" };
    }
  }

  const companyId = taskRows[0].company_id;

  // 2) Load machines for that company
  const { data: machines, error: mErr } = await supabase
    .from("machines")
    .select("id, type, status, company_id")
    .eq("company_id", companyId);

  if (mErr) {
    console.error("[startWorkOrder] load machines failed:", mErr.message);
    return { ok: false, assigned: 0, total: 0, reason: mErr.message };
  }
  const machineRows = (machines || []) as MachineRow[];
  const machineById = new Map(machineRows.map((m) => [m.id, m]));

  // 2b) Load machine_capabilities for these machines (process + bar_code).
  // capMap: machineId -> Set of "process:bar_code" strings.
  const machineIds = machineRows.map((m) => m.id);
  const capMap = new Map<string, Set<string>>();
  let capabilitiesKnown = false;
  if (machineIds.length > 0) {
    const { data: caps, error: capErr } = await supabase
      .from("machine_capabilities")
      .select("machine_id, bar_code, process")
      .in("machine_id", machineIds);
    if (capErr) {
      console.warn("[startWorkOrder] load capabilities failed (falling back to type match):", capErr.message);
    } else {
      capabilitiesKnown = (caps || []).length > 0;
      for (const c of caps || []) {
        const key = `${(c as any).process}:${(c as any).bar_code}`;
        const set = capMap.get((c as any).machine_id) ?? new Set<string>();
        set.add(key);
        capMap.set((c as any).machine_id, set);
      }
    }
  }

  // 2c) Live queue snapshot across all company machines (queued + running),
  // joined with production_tasks.setup_key so we can detect existing
  // same-setup affinity and current load per machine.
  const liveLoad = new Map<string, number>(); // machineId -> count of active queue rows
  const setupAffinity = new Map<string, Map<string, number>>(); // setupKey -> Map<machineId, count>
  if (machineIds.length > 0) {
    const { data: liveRows, error: liveErr } = await supabase
      .from("machine_queue_items")
      .select("machine_id, task_id, production_tasks:task_id(setup_key, task_type, bar_code, grade)")
      .in("machine_id", machineIds)
      .in("status", ["queued", "running"]);
    if (liveErr) {
      console.warn("[startWorkOrder] live queue snapshot failed:", liveErr.message);
    } else {
      for (const row of liveRows || []) {
        const mid = (row as any).machine_id as string;
        liveLoad.set(mid, (liveLoad.get(mid) ?? 0) + 1);
        const pt = (row as any).production_tasks as
          | { setup_key: string | null; task_type: string | null; bar_code: string | null; grade: string | null }
          | null;
        if (!pt) continue;
        const sk = deriveSetupKey(pt);
        if (!sk) continue;
        const inner = setupAffinity.get(sk) ?? new Map<string, number>();
        inner.set(mid, (inner.get(mid) ?? 0) + 1);
        setupAffinity.set(sk, inner);
      }
    }
  }

  // 3) Setup-key aware machine picker.
  // Priority: locked → capable+affinity → capable+least-loaded → round-robin fallback.
  const idleStatuses = new Set(["idle", "running"]);
  const isUsable = (m: MachineRow) => idleStatuses.has(m.status);

  // Type-based fallback pool (used only when machine_capabilities is empty).
  const idleByType = new Map<string, MachineRow[]>();
  for (const m of machineRows) {
    if (!isUsable(m)) continue;
    if (!idleByType.has(m.type)) idleByType.set(m.type, []);
    idleByType.get(m.type)!.push(m);
  }
  for (const [k, arr] of idleByType) {
    arr.sort((a, b) => (a.status === "idle" ? -1 : 1) - (b.status === "idle" ? -1 : 1));
    idleByType.set(k, arr);
  }
  const rrCursor = new Map<string, number>();

  type Pick = { machine: MachineRow; reason: string; affinityUsed: boolean; rrFallback: boolean };

  const capablePool = (process: "cut" | "bend", barCode: string | null): MachineRow[] => {
    if (capabilitiesKnown) {
      const key = `${process}:${(barCode || "").trim()}`;
      return machineRows.filter((m) => isUsable(m) && capMap.get(m.id)?.has(key));
    }
    // Back-compat: no capabilities defined → use type buckets.
    const wantType = process === "cut" ? "cutter" : "bender";
    return idleByType.get(wantType) ?? [];
  };

  const pickForTask = (task: TaskRow): Pick | null => {
    // 1) Respect explicit lock.
    if (task.locked_to_machine_id) {
      const m = machineById.get(task.locked_to_machine_id);
      if (m) return { machine: m, reason: "locked_to_machine_id", affinityUsed: false, rrFallback: false };
    }
    const process = processForTask(task.task_type);
    if (!process) {
      // Unknown task type — fall back to any idle machine via legacy round-robin.
      const pool = [...idleByType.values()].flat();
      if (pool.length === 0) return null;
      const i = (rrCursor.get("__any__") ?? 0) % pool.length;
      rrCursor.set("__any__", i + 1);
      return { machine: pool[i], reason: "fallback_any_idle", affinityUsed: false, rrFallback: true };
    }
    const pool = capablePool(process, task.bar_code);
    if (pool.length === 0) {
      // No capable machine. As a last resort, try type-bucket fallback so the
      // dispatch does not silently drop the task.
      const fallback = idleByType.get(process === "cut" ? "cutter" : "bender") ?? [];
      if (fallback.length === 0) return null;
      const i = (rrCursor.get(`${process}:fallback`) ?? 0) % fallback.length;
      rrCursor.set(`${process}:fallback`, i + 1);
      return {
        machine: fallback[i],
        reason: "no_capable_machine_fallback_type",
        affinityUsed: false,
        rrFallback: true,
      };
    }
    const setupKey = deriveSetupKey(task);
    // 2) Same setup_key affinity (running/queued on any capable machine).
    if (setupKey) {
      const affinity = setupAffinity.get(setupKey);
      if (affinity && affinity.size > 0) {
        const candidates = pool
          .map((m) => ({ m, count: affinity.get(m.id) ?? 0 }))
          .filter((c) => c.count > 0)
          .sort((a, b) => b.count - a.count || (liveLoad.get(a.m.id) ?? 0) - (liveLoad.get(b.m.id) ?? 0));
        if (candidates.length > 0) {
          return {
            machine: candidates[0].m,
            reason: "same_setup_key_affinity",
            affinityUsed: true,
            rrFallback: false,
          };
        }
      }
    }
    // 3) Least-loaded capable machine; tiebreak round-robin.
    const sorted = pool
      .map((m) => ({ m, load: liveLoad.get(m.id) ?? 0 }))
      .sort((a, b) => a.load - b.load);
    const minLoad = sorted[0].load;
    const tied = sorted.filter((c) => c.load === minLoad).map((c) => c.m);
    if (tied.length === 1) {
      return { machine: tied[0], reason: "least_loaded", affinityUsed: false, rrFallback: false };
    }
    const cursorKey = `${process}:${(task.bar_code || "").trim()}`;
    const i = (rrCursor.get(cursorKey) ?? 0) % tied.length;
    rrCursor.set(cursorKey, i + 1);
    return { machine: tied[i], reason: "round_robin_tiebreak", affinityUsed: false, rrFallback: true };
  };

  // 4) Load existing active queue rows for these tasks (to avoid duplicates).
  const taskIds = taskRows.map((t) => t.id);
  const { data: existing } = await supabase
    .from("machine_queue_items")
    .select("id, task_id, machine_id, position, status")
    .in("task_id", taskIds)
    .in("status", ["queued", "running"]);
  const existingByTask = new Map<string, any>();
  for (const r of existing || []) existingByTask.set((r as any).task_id, r);

  // 5) Per-machine max position cache (used for new inserts)
  const maxPosByMachine = new Map<string, number>();
  const ensureMaxPos = async (machineId: string): Promise<number> => {
    if (maxPosByMachine.has(machineId)) return maxPosByMachine.get(machineId)!;
    const { data } = await supabase
      .from("machine_queue_items")
      .select("position")
      .eq("machine_id", machineId)
      .order("position", { ascending: false })
      .limit(1);
    const max = (data && data[0]?.position) ?? 0;
    maxPosByMachine.set(machineId, max);
    return max;
  };

  // 6) Walk tasks, upsert queue rows, flip task status, audit each dispatch.
  let assigned = 0;
  for (const task of taskRows) {
    const existingRow = existingByTask.get(task.id);
    let machineId: string | null = existingRow?.machine_id ?? null;
    let pickReason = "preexisting_queue_row";
    let affinityUsed = false;
    let rrFallback = false;

    if (!machineId) {
      const picked = pickForTask(task);
      if (!picked) continue; // no machine available; leave task alone
      machineId = picked.machine.id;
      pickReason = picked.reason;
      affinityUsed = picked.affinityUsed;
      rrFallback = picked.rrFallback;
    }

    if (existingRow) {
      const { error: upErr } = await supabase
        .from("machine_queue_items")
        .update({ status: "running", machine_id: machineId })
        .eq("id", existingRow.id)
        .select("id");
      if (upErr) {
        console.error("[startWorkOrder] queue update failed:", upErr.message);
        continue;
      }
    } else {
      const nextPos = (await ensureMaxPos(machineId)) + 1;
      maxPosByMachine.set(machineId, nextPos);
      const { error: insErr } = await supabase.from("machine_queue_items").insert({
        company_id: companyId,
        task_id: task.id,
        machine_id: machineId,
        work_order_id: workOrderId,
        project_id: workOrderId,
        position: nextPos,
        status: "running",
      });
      if (insErr) {
        console.error("[startWorkOrder] queue insert failed:", insErr.message);
        continue;
      }
    }

    await supabase
      .from("production_tasks")
      .update({ status: "in_progress" })
      .eq("id", task.id)
      .select("id");

    // 6b) Update in-memory load + affinity so subsequent tasks in this batch
    // see the new placement.
    liveLoad.set(machineId, (liveLoad.get(machineId) ?? 0) + 1);
    const sk = deriveSetupKey(task);
    if (sk) {
      const inner = setupAffinity.get(sk) ?? new Map<string, number>();
      inner.set(machineId, (inner.get(machineId) ?? 0) + 1);
      setupAffinity.set(sk, inner);
    }

    // 6c) Audit — activity_events row per dispatch (best effort, non-blocking).
    try {
      const machine = machineById.get(machineId);
      await supabase.from("activity_events").insert({
        company_id: companyId,
        source: "workOrderDispatch",
        event_type: "task_dispatched",
        entity_type: "production_task",
        entity_id: task.id,
        actor_type: "system",
        description: `Task ${task.id} → ${machine?.type ?? "machine"} ${machineId} (${pickReason})`,
        metadata: {
          dispatch_path: "legacy_setup_key_aware",
          task_id: task.id,
          work_order_id: workOrderId,
          machine_id: machineId,
          machine_type: machine?.type ?? null,
          setup_key: sk,
          bar_code: task.bar_code,
          grade: task.grade,
          reason: pickReason,
          affinity_used: affinityUsed,
          round_robin_fallback: rrFallback,
          locked: !!task.locked_to_machine_id,
          preexisting: !!existingRow,
        },
      });
    } catch (e) {
      console.warn("[startWorkOrder] audit insert failed:", (e as Error).message);
    }

    assigned += 1;
  }


  if (assigned === 0) {
    const wantedTypes = new Set(
      taskRows.map((t) => machineTypeForTask(t.task_type)).filter((x): x is string => !!x),
    );
    const reason =
      wantedTypes.size === 1
        ? `No idle ${[...wantedTypes][0]} machines available`
        : "No idle machines available";
    console.debug("[startWorkOrder]", { workOrderId, blockedReason: reason });
    return { ok: false, assigned: 0, total: taskRows.length, reason };
  }


  return { ok: true, assigned, total: taskRows.length };
}

export async function pauseWorkOrder(workOrderId: string): Promise<DispatchResult> {
  // Flip running queue rows back to queued (machine + position preserved)
  const { data: queued, error: qErr } = await supabase
    .from("machine_queue_items")
    .update({ status: "queued" })
    .eq("work_order_id", workOrderId)
    .eq("status", "running")
    .select("id, task_id");

  if (qErr) {
    console.error("[pauseWorkOrder] queue pause failed:", qErr.message);
    return { ok: false, assigned: 0, total: 0, reason: qErr.message };
  }

  const taskIds = (queued || []).map((r: any) => r.task_id).filter(Boolean);
  if (taskIds.length > 0) {
    await supabase
      .from("production_tasks")
      .update({ status: "pending" })
      .in("id", taskIds)
      .select("id");
  }

  return { ok: true, assigned: queued?.length ?? 0, total: queued?.length ?? 0 };
}
