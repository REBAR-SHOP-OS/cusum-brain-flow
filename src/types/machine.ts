export type MachineType = "cutter" | "bender" | "loader" | "other";
export type MachineStatus = "idle" | "running" | "blocked" | "down";

export interface Machine {
  id: string;
  company_id: string;
  warehouse_id: string | null;
  name: string;
  model: string | null;
  type: MachineType;
  status: MachineStatus;
  current_run_id: string | null;
  current_operator_profile_id: string | null;
  last_event_at: string | null;
  created_at: string;
  updated_at: string;
  /** Phase 2: ID of the active cut_plan_item locked to this machine */
  active_job_id: string | null;
  /** Phase 2: ID of the cut_plan being worked on */
  active_plan_id: string | null;
  /** Phase 2: Current session status — 'idle' | 'running' | 'paused' */
  cut_session_status: string | null;
  /** Phase 2: Who assigned the current job — 'manual' | 'optimizer' | 'supervisor' */
  job_assigned_by: string | null;
  /** Phase 2: Hard lock preventing job switches during active runs */
  machine_lock: boolean | null;
}

/** Machine with joined operator profile and current run */
export interface LiveMachine extends Machine {
  operator?: { id: string; full_name: string } | null;
  current_run?: {
    id: string;
    status: string;
    process: string;
    started_at: string | null;
    notes: string | null;
  } | null;
  /** Queued machine_runs waiting to be started on this machine */
  queued_runs?: QueuedRun[];
}

/** A queued run waiting to start */
export interface QueuedRun {
  id: string;
  process: string;
  status: string;
  input_qty: number | null;
  notes: string | null;
  created_at: string;
}
