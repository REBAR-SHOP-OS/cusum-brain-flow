import { supabase } from "@/integrations/supabase/client";
import type { MachineRun, MachineRunProcess, MachineRunStatus } from "@/types/machineRun";

export interface LogMachineRunParams {
  machineRunId?: string;
  companyId: string;
  machineId: string;
  process: MachineRunProcess;
  status: MachineRunStatus;
  workOrderId?: string | null;
  operatorProfileId?: string | null;
  supervisorProfileId?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  inputQty?: number | null;
  outputQty?: number | null;
  scrapQty?: number | null;
  notes?: string | null;
  createdBy?: string | null;
}

export interface LogMachineRunResult {
  machineRun: MachineRun;
  event: string;
}

/**
 * Logs a machine run event by calling the log-machine-run edge function.
 *
 * - Creates or updates a row in machine_runs (RLS enforced).
 * - Automatically logs an event in the events table.
 * - Blocked for users with only the 'office' role.
 *
 * @throws Error if the request fails or the user lacks permissions.
 */
export async function logMachineRunEvent(
  params: LogMachineRunParams
): Promise<LogMachineRunResult> {
  const { data, error } = await supabase.functions.invoke("log-machine-run", {
    body: params,
  });

  if (error) {
    throw new Error(error.message || "Failed to log machine run event");
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data as LogMachineRunResult;
}
