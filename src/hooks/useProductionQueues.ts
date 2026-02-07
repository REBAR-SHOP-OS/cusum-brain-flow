import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useEffect } from "react";
import type { QueueItemWithTask } from "@/lib/dispatchService";
export type { QueueItemWithTask };

export interface ProjectLane {
  projectId: string | null;
  projectName: string | null;
  items: QueueItemWithTask[];
}

export function useProductionQueues() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["production-queues"],
    enabled: !!user,
    queryFn: async () => {
      // Fetch queue items with joined tasks
      const { data: queueItems, error: qErr } = await (supabase as any)
        .from("machine_queue_items")
        .select(`
          id, task_id, machine_id, project_id, work_order_id, position, status, created_at,
          task:production_tasks(id, task_type, bar_code, grade, setup_key, priority, status, mark_number, drawing_ref, cut_length_mm, asa_shape_code, qty_required, qty_completed, project_id, work_order_id)
        `)
        .in("status", ["queued", "running"])
        .order("position", { ascending: true });

      if (qErr) throw qErr;
      return (queueItems || []) as QueueItemWithTask[];
    },
  });

  // Fetch work order names for project labels
  const projectIds = [...new Set((data || []).map((q) => q.project_id).filter(Boolean))] as string[];
  const { data: workOrders } = useQuery({
    queryKey: ["work-order-names", projectIds],
    enabled: !!user && projectIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_orders")
        .select("id, order_number")
        .in("id", projectIds);
      if (error) throw error;
      return data || [];
    },
  });

  const woMap = new Map((workOrders || []).map((wo: any) => [wo.id, wo.order_number]));

  // Realtime subscriptions
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("production-queues-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "machine_queue_items" },
        () => queryClient.invalidateQueries({ queryKey: ["production-queues"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "production_tasks" },
        () => queryClient.invalidateQueries({ queryKey: ["production-queues"] }))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  // Group by machine
  const byMachine = new Map<string, QueueItemWithTask[]>();
  for (const item of (data || [])) {
    if (!byMachine.has(item.machine_id)) byMachine.set(item.machine_id, []);
    byMachine.get(item.machine_id)!.push(item);
  }

  // Group by project (lanes)
  const projectLanes: ProjectLane[] = [];
  const byProject = new Map<string, QueueItemWithTask[]>();
  for (const item of (data || [])) {
    const pid = item.project_id || "unassigned";
    if (!byProject.has(pid)) byProject.set(pid, []);
    byProject.get(pid)!.push(item);
  }
  for (const [pid, items] of byProject) {
    projectLanes.push({
      projectId: pid === "unassigned" ? null : pid,
      projectName: pid === "unassigned" ? "Unassigned" : woMap.get(pid) || pid.slice(0, 8),
      items: items.sort((a, b) => a.position - b.position),
    });
  }

  return {
    queueItems: data ?? [],
    byMachine,
    projectLanes,
    isLoading,
    error,
  };
}
