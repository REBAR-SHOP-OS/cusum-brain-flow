import { supabase } from "@/integrations/supabase/client";

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
 * Handles reservation, consumption, remnant/scrap creation, and replanning.
 */
export async function manageInventory(
  params: InventoryParams
): Promise<{ success: boolean; action: string }> {
  const { data, error } = await supabase.functions.invoke("manage-inventory", {
    body: params,
  });

  if (error) throw new Error(error.message || "Failed to manage inventory");
  if (data?.error) throw new Error(data.error);

  return data;
}
