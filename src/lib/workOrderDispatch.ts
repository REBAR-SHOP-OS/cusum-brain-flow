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
type TaskRow = { id: string; task_type: string | null; status: string | null; company_id: string };

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
  // 1) Load tasks for this WO that are dispatchable
  const { data: tasks, error: tErr } = await supabase
    .from("production_tasks")
    .select("id, task_type, status, company_id")
    .eq("work_order_id", workOrderId)
    .in("status", ["pending", "queued", "on_hold", "in_progress"]);

  if (tErr) {
    console.error("[startWorkOrder] load tasks failed:", tErr.message);
    return { ok: false, assigned: 0, total: 0, reason: tErr.message };
  }
  const taskRows = (tasks || []) as TaskRow[];
  if (taskRows.length === 0) {
    return { ok: false, assigned: 0, total: 0, reason: "No tasks to dispatch" };
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

  // 3) Bucket idle machines by type; round-robin within type
  const idleByType = new Map<string, MachineRow[]>();
  for (const m of machineRows) {
    if (m.status !== "idle" && m.status !== "running") continue;
    if (!idleByType.has(m.type)) idleByType.set(m.type, []);
    idleByType.get(m.type)!.push(m);
  }
  // Prefer purely idle first
  for (const [k, arr] of idleByType) {
    arr.sort((a, b) => (a.status === "idle" ? -1 : 1) - (b.status === "idle" ? -1 : 1));
    idleByType.set(k, arr);
  }
  const cursor = new Map<string, number>();
  const pickMachine = (taskType: string | null): MachineRow | null => {
    const wantType = machineTypeForTask(taskType);
    const tryTypes = wantType
      ? [wantType, ...[...idleByType.keys()].filter((t) => t !== wantType)]
      : [...idleByType.keys()];
    for (const t of tryTypes) {
      const pool = idleByType.get(t);
      if (!pool || pool.length === 0) continue;
      const i = (cursor.get(t) ?? 0) % pool.length;
      cursor.set(t, i + 1);
      return pool[i];
    }
    return null;
  };

  // 4) Load existing active queue rows for these tasks
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

  // 6) Walk tasks, upsert queue rows, flip task status
  let assigned = 0;
  for (const task of taskRows) {
    const existingRow = existingByTask.get(task.id);
    let machineId: string | null = existingRow?.machine_id ?? null;

    if (!machineId) {
      const picked = pickMachine(task.task_type);
      if (!picked) continue; // no machine available; leave task alone
      machineId = picked.id;
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

    assigned += 1;
  }

  if (assigned === 0) {
    return {
      ok: false,
      assigned: 0,
      total: taskRows.length,
      reason: "No idle machines available",
    };
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
