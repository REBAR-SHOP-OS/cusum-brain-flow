import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
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
 */
export async function logMachineRunEvent(
  params: LogMachineRunParams
): Promise<LogMachineRunResult> {
  return invokeEdgeFunction<LogMachineRunResult>("log-machine-run", params as any);
}
