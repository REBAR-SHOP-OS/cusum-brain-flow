export type MachineType = "cutter" | "bender" | "loader" | "other";
export type MachineStatus = "idle" | "running" | "blocked" | "down";

export interface Machine {
  id: string;
  company_id: string;
  warehouse_id: string | null;
  name: string;
  type: MachineType;
  status: MachineStatus;
  current_run_id: string | null;
  current_operator_profile_id: string | null;
  last_event_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Machine with joined operator profile and current run */
export interface LiveMachine extends Machine {
  operator?: { id: string; full_name: string } | null;
  current_run?: {
    id: string;
    status: string;
    process: string;
    started_at: string | null;
  } | null;
}
