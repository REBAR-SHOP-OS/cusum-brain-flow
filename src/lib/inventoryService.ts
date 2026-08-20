import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";

export type InventoryAction =
  | "reserve"
  | "consume-on-start"
  | "cut-complete"
  | "release"
  | "replan";

export interface InventoryParams {
  action: InventoryAction;
  cutPlanId?: string;
  cutPlanItemId?: string;
  machineRunId?: string;
  barCode?: string;
  qty?: number;
  sourceType?: "lot" | "remnant" | "floor" | "wip";
  sourceId?: string;
  stockLengthMm?: number;
  cutLengthMm?: number;
  piecesPerBar?: number;
  bars?: number;
  reason?: string;
}

/**
 * Calls the manage-inventory edge function.
 */
export async function manageInventory(
  params: InventoryParams
): Promise<{ success: boolean; action: string }> {
  return invokeEdgeFunction("manage-inventory", params as any);
}
