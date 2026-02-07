import { supabase } from "@/integrations/supabase/client";

export type DispatchAction = "dispatch" | "start-task" | "move-task" | "get-queues";

export interface DispatchParams {
  action: DispatchAction;
  taskId?: string;
  queueItemId?: string;
  targetMachineId?: string;
  targetPosition?: number;
}

export interface QueueItemWithTask {
  id: string;
  task_id: string;
  machine_id: string;
  project_id: string | null;
  work_order_id: string | null;
  barlist_id: string | null;
  position: number;
  status: string;
  created_at: string;
  task: {
    id: string;
    task_type: string;
    bar_code: string;
    grade: string | null;
    setup_key: string | null;
    priority: number;
    status: string;
    mark_number: string | null;
    drawing_ref: string | null;
    cut_length_mm: number | null;
    asa_shape_code: string | null;
    qty_required: number;
    qty_completed: number;
    project_id: string | null;
    work_order_id: string | null;
    barlist_id: string | null;
  } | null;
}

/**
 * Calls the smart-dispatch edge function.
 * Handles task dispatching, starting, moving, and queue retrieval.
 */
export async function smartDispatch(
  params: DispatchParams
): Promise<{ success: boolean; action: string; queueItems?: QueueItemWithTask[] }> {
  const { data, error } = await supabase.functions.invoke("smart-dispatch", {
    body: params,
  });

  if (error) throw new Error(error.message || "Dispatch failed");
  if (data?.error) throw new Error(data.error);

  return data;
}
