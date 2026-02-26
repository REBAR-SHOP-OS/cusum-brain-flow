import { supabase } from "@/integrations/supabase/client";

export type ManageMachineAction =
  | "update-status"
  | "assign-operator"
  | "start-run"
  | "start-queued-run"
  | "pause-run"
  | "block-run"
  | "complete-run";

export interface ManageMachineParams {
  action: ManageMachineAction;
  machineId: string;
  status?: string;
  operatorProfileId?: string | null;
  process?: string;
  workOrderId?: string;
  notes?: string;
  outputQty?: number;
  scrapQty?: number;
  /** RSIC Canada bar code (e.g. '10M', '25M', '55M'). Required for capability validation. */
  barCode?: string;
  /** Number of bars to process. Validated against machine_capabilities.max_bars. */
  qty?: number;
  /** ID of an existing queued run to start */
  runId?: string;
}

/**
 * Calls the manage-machine edge function.
 * Requires admin or workshop role. Office users are blocked server-side.
 *
 * For start-run: if barCode is provided, the server validates:
 *   (machine + process + barCode + qty) ∈ machine_capabilities
 * If not matched → 403 capability_violation event is logged.
 */
export async function manageMachine(
  params: ManageMachineParams
): Promise<{ success: boolean; machineId: string; action: string; machineRunId?: string }> {
  // Client-side input validation
  if (!params.machineId || params.machineId === "null" || params.machineId === "undefined") {
    throw new Error("Invalid machineId");
  }
  if (params.qty !== undefined && params.qty < 0) {
    throw new Error("qty cannot be negative");
  }
  if (params.outputQty !== undefined && params.outputQty < 0) {
    throw new Error("outputQty cannot be negative");
  }
  if (params.scrapQty !== undefined && params.scrapQty < 0) {
    throw new Error("scrapQty cannot be negative");
  }

  const { data, error } = await supabase.functions.invoke("manage-machine", {
    body: params,
  });

  if (error) throw new Error(error.message || "Failed to manage machine");
  if (data?.error) throw new Error(data.error);

  return data as { success: boolean; machineId: string; action: string; machineRunId?: string };
}
