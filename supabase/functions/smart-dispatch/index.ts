import { handleRequest } from "../_shared/requestHandler.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { corsHeaders } from "../_shared/auth.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve((req) =>
  handleRequest(req, async (ctx) => {
    const { userId, serviceClient: svc, body: rawBody } = ctx;

    // Role check
    const { data: userRoles } = await svc.from("user_roles").select("role").eq("user_id", userId);
    const roles = (userRoles || []).map((r: { role: string }) => r.role);
    const hasWriteRole = roles.some((r: string) => ["admin", "workshop"].includes(r));

    // Get company
    const { data: profile } = await svc.from("profiles").select("company_id").eq("user_id", userId).maybeSingle();
    if (!profile?.company_id) return json({ error: "No company assigned" }, 400);
    const companyId = profile.company_id;

    const topSchema = z.object({
      action: z.enum(["dispatch", "start-task", "move-task", "get-queues"]),
    }).passthrough();
    const parsed = topSchema.safeParse(rawBody);
    if (!parsed.success) {
      return json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, 400);
    }
    const body = parsed.data;
    const { action } = body;
    const now = new Date().toISOString();
    const events: Record<string, unknown>[] = [];

    switch (action) {
      case "dispatch": {
        if (!hasWriteRole) return json({ error: "Forbidden" }, 403);
        const { taskId } = body;
        if (!taskId) return json({ error: "Missing taskId" }, 400);

        const { data: task, error: taskErr } = await svc
          .from("production_tasks")
          .select("*")
          .eq("id", taskId)
          .single();
        if (taskErr || !task) return json({ error: "Task not found" }, 404);
        if (task.status === "running" || task.status === "done") {
          return json({ error: `Task already ${task.status}` }, 400);
        }

        if (task.locked_to_machine_id) {
          const position = await getNextPosition(svc, task.locked_to_machine_id);
          const { data: qi, error: qiErr } = await svc.from("machine_queue_items").insert({
            company_id: companyId,
            task_id: taskId,
            machine_id: task.locked_to_machine_id,
            project_id: task.project_id,
            work_order_id: task.work_order_id,
            position,
            status: "queued",
          }).select().single();

          if (qiErr) {
            if (qiErr.message?.includes("idx_queue_task_active")) {
              return json({ error: "Task already in an active queue" }, 409);
            }
            throw qiErr;
          }

          await svc.from("production_tasks").update({ status: "queued" }).eq("id", taskId);

          events.push({
            entity_type: "production_task",
            entity_id: taskId,
            event_type: "task_dispatched",
            actor_id: userId,
            actor_type: "user",
            description: `Task dispatched to locked machine (position ${position})`,
            metadata: { taskId, machineId: task.locked_to_machine_id, position, locked: true },
          });
          break;
        }

        const processMap: Record<string, string> = { cut: "cut", bend: "bend", spiral: "bend", load: "load", other: "other" };
        const machineProcess = processMap[task.task_type] || task.task_type;

        const { data: capabilities } = await svc
          .from("machine_capabilities")
          .select("machine_id, max_bars")
          .eq("bar_code", task.bar_code)
          .eq("process", machineProcess);

        if (!capabilities?.length) {
          return json({ error: `No machine capable of ${machineProcess} ${task.bar_code}` }, 400);
        }

        const capableMachineIds = capabilities.map((c: any) => c.machine_id);

        const { data: machines } = await svc
          .from("machines")
          .select("id, name, status, current_run_id")
          .in("id", capableMachineIds)
          .eq("company_id", companyId);

        if (!machines?.length) return json({ error: "No available machines" }, 400);

        const { data: queueCounts } = await svc
          .from("machine_queue_items")
          .select("machine_id")
          .in("machine_id", capableMachineIds)
          .in("status", ["queued", "running"]);

        const queueMap = new Map<string, number>();
        for (const q of (queueCounts || [])) {
          const mid = (q as any).machine_id;
          queueMap.set(mid, (queueMap.get(mid) || 0) + 1);
        }

        const { data: currentSetups } = await svc
          .from("machine_queue_items")
          .select("machine_id, task_id")
          .in("machine_id", capableMachineIds)
          .eq("status", "running");

        const setupMap = new Map<string, string>();
        if (currentSetups?.length) {
          const runningTaskIds = currentSetups.map((s: any) => s.task_id);
          const { data: runningTasks } = await svc
            .from("production_tasks")
            .select("id, setup_key")
            .in("id", runningTaskIds);
          for (const rt of (runningTasks || [])) {
            const cs = currentSetups.find((s: any) => s.task_id === (rt as any).id);
            if (cs) setupMap.set((cs as any).machine_id, (rt as any).setup_key || "");
          }
        }

        let bestMachine = machines[0];
        let bestScore = -Infinity;

        for (const m of machines) {
          let score = 0;
          if (m.status === "idle" && !m.current_run_id) score += 50;
          else if (m.status === "running") score += 10;
          if (m.status === "blocked") score -= 30;
          if (m.status === "down") score -= 100;
          const qLen = queueMap.get(m.id) || 0;
          score -= qLen * 10;
          const currentSetup = setupMap.get(m.id);
          if (currentSetup && currentSetup === task.setup_key) score += 25;

          if (score > bestScore) {
            bestScore = score;
            bestMachine = m;
          }
        }

        const position = await getNextPosition(svc, bestMachine.id);
        const { error: qiErr } = await svc.from("machine_queue_items").insert({
          company_id: companyId,
          task_id: taskId,
          machine_id: bestMachine.id,
          project_id: task.project_id,
          work_order_id: task.work_order_id,
          position,
          status: "queued",
        });

        if (qiErr) {
          if (qiErr.message?.includes("idx_queue_task_active")) {
            return json({ error: "Task already in an active queue" }, 409);
          }
          throw qiErr;
        }

        await svc.from("production_tasks").update({ status: "queued" }).eq("id", taskId);

        events.push({
          entity_type: "production_task",
          entity_id: taskId,
          event_type: "task_dispatched",
          actor_id: userId,
          actor_type: "user",
          description: `Smart dispatch: ${task.bar_code} ${task.task_type} → ${bestMachine.name} (score ${bestScore}, pos ${position})`,
          metadata: { taskId, machineId: bestMachine.id, machineName: bestMachine.name, score: bestScore, position, setupKey: task.setup_key },
        });
        break;
      }

      case "start-task": {
        if (!hasWriteRole) return json({ error: "Forbidden" }, 403);
        const { queueItemId } = body;
        if (!queueItemId) return json({ error: "Missing queueItemId" }, 400);

        const { data: qi, error: qiErr } = await svc
          .from("machine_queue_items")
          .select("*")
          .eq("id", queueItemId)
          .single();
        if (qiErr || !qi) return json({ error: "Queue item not found" }, 404);
        if (qi.status !== "queued") return json({ error: `Queue item already ${qi.status}` }, 400);

        const { data: task } = await svc
          .from("production_tasks")
          .select("*")
          .eq("id", qi.task_id)
          .single();
        if (!task) return json({ error: "Task not found" }, 404);
        if (task.status === "running") return json({ error: "Task already running" }, 409);
        if (task.status === "done") return json({ error: "Task already completed" }, 400);

        const { data: machine } = await svc
          .from("machines")
          .select("id, name, status, current_run_id, company_id, current_operator_profile_id")
          .eq("id", qi.machine_id)
          .single();
        if (!machine) return json({ error: "Machine not found" }, 404);
        if (machine.current_run_id) return json({ error: "Machine already has an active run" }, 400);

        await svc.from("production_tasks").update({ status: "running" }).eq("id", qi.task_id);
        await svc.from("machine_queue_items").update({ status: "running" }).eq("id", queueItemId);

        const processMap2: Record<string, string> = { cut: "cut", bend: "bend", spiral: "bend", load: "load", other: "other" };
        const runProcess = processMap2[task.task_type] || "other";

        const { data: newRun, error: runErr } = await svc
          .from("machine_runs")
          .insert({
            company_id: machine.company_id,
            machine_id: qi.machine_id,
            process: runProcess,
            status: "running",
            started_at: now,
            operator_profile_id: machine.current_operator_profile_id,
            created_by: userId,
            input_qty: task.qty_required,
            notes: `Task: ${task.mark_number || task.id} | ${task.bar_code} | ${task.task_type}`,
          })
          .select()
          .single();
        if (runErr) throw runErr;

        await svc.from("machines").update({
          current_run_id: newRun.id,
          status: "running",
          last_event_at: now,
        }).eq("id", qi.machine_id);

        events.push(
          {
            entity_type: "production_task",
            entity_id: qi.task_id,
            event_type: "task_started",
            actor_id: userId,
            actor_type: "user",
            description: `Task started: ${task.bar_code} ${task.task_type} on ${machine.name}`,
            metadata: { taskId: qi.task_id, machineId: qi.machine_id, machineRunId: newRun.id, queueItemId },
          },
          {
            entity_type: "machine",
            entity_id: qi.machine_id,
            event_type: "machine_status_changed",
            actor_id: userId,
            actor_type: "user",
            description: `Machine ${machine.name}: ${machine.status} → running`,
            metadata: { machineId: qi.machine_id, oldStatus: machine.status, newStatus: "running" },
          }
        );
        break;
      }

      case "move-task": {
        if (!hasWriteRole) return json({ error: "Forbidden" }, 403);
        const { queueItemId, targetMachineId, targetPosition } = body;
        if (!queueItemId) return json({ error: "Missing queueItemId" }, 400);

        const { data: qi } = await svc
          .from("machine_queue_items")
          .select("*")
          .eq("id", queueItemId)
          .single();
        if (!qi) return json({ error: "Queue item not found" }, 404);
        if (qi.status !== "queued") return json({ error: "Can only move queued items" }, 400);

        const updates: Record<string, unknown> = {};
        if (targetMachineId && targetMachineId !== qi.machine_id) {
          const { data: task } = await svc.from("production_tasks").select("task_type, bar_code").eq("id", qi.task_id).single();
          if (task) {
            const processMap3: Record<string, string> = { cut: "cut", bend: "bend", spiral: "bend", load: "load", other: "other" };
            const { data: cap } = await svc
              .from("machine_capabilities")
              .select("id")
              .eq("machine_id", targetMachineId)
              .eq("bar_code", task.bar_code)
              .eq("process", processMap3[task.task_type] || "other")
              .maybeSingle();
            if (!cap) return json({ error: "Target machine lacks capability for this task" }, 403);
          }
          updates.machine_id = targetMachineId;
          const newPos = targetPosition ?? await getNextPosition(svc, targetMachineId);
          updates.position = newPos;
        } else if (targetPosition !== undefined) {
          updates.position = targetPosition;
        }

        if (Object.keys(updates).length) {
          await svc.from("machine_queue_items").update(updates).eq("id", queueItemId);
          events.push({
            entity_type: "production_task",
            entity_id: qi.task_id,
            event_type: "task_rerouted",
            actor_id: userId,
            actor_type: "user",
            description: `Task moved to machine ${targetMachineId || qi.machine_id} position ${updates.position || qi.position}`,
            metadata: { queueItemId, taskId: qi.task_id, fromMachine: qi.machine_id, toMachine: targetMachineId || qi.machine_id, position: updates.position },
          });
        }
        break;
      }

      case "get-queues": {
        const { data: queueItems, error: qErr } = await svc
          .from("machine_queue_items")
          .select(`
            id, task_id, machine_id, project_id, work_order_id, position, status, created_at,
            task:production_tasks(id, task_type, bar_code, grade, setup_key, priority, status, mark_number, drawing_ref, cut_length_mm, asa_shape_code, qty_required, qty_completed, project_id, work_order_id)
          `)
          .eq("company_id", companyId)
          .in("status", ["queued", "running"])
          .order("position", { ascending: true });

        if (qErr) throw qErr;
        return json({ success: true, queueItems: queueItems || [] });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }

    if (events.length > 0) {
      const { error: evtErr } = await svc.from("activity_events").insert(events.map((e: any) => ({ ...e, source: "system", company_id: companyId })));
      if (evtErr) console.error("Failed to log events:", evtErr);
    }

    return json({ success: true, action });
  }, { functionName: "smart-dispatch", requireCompany: false, wrapResult: false })
);

async function getNextPosition(svc: any, machineId: string): Promise<number> {
  const { data } = await svc
    .from("machine_queue_items")
    .select("position")
    .eq("machine_id", machineId)
    .in("status", ["queued", "running"])
    .order("position", { ascending: false })
    .limit(1);
  return data?.length ? (data[0] as any).position + 1 : 0;
}
