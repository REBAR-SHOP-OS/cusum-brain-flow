import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";

export type ManageMachineAction =
  | "update-status"
  | "assign-operator"
  | "start-run"
  | "start-queued-run"
  | "pause-run"
  | "block-run"
  | "complete-run"
  | "supervisor-unlock";

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
  barCode?: string;
  qty?: number;
  runId?: string;
  cutPlanItemId?: string;
  cutPlanId?: string;
  assignedBy?: string;
  plannedQty?: number;
  remnantLengthMm?: number;
  remnantBarCode?: string;
}

/**
 * Calls the manage-machine edge function.
 * Requires admin or workshop role. Office users are blocked server-side.
 */
export async function manageMachine(
  params: ManageMachineParams,
  options?: { timeoutMs?: number; retries?: number },
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

  return invokeEdgeFunction("manage-machine", params as any, options);
}
