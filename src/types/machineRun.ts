/**
 * TypeScript interface for the public.machine_runs table.
 *
 * process:  'cut' | 'bend' | 'load' | 'pickup' | 'delivery' | 'clearance' | 'other'
 * status:   'queued' | 'running' | 'paused' | 'blocked' | 'completed' | 'rejected' | 'canceled'
 * duration_seconds is a GENERATED column — do not include in inserts/updates.
 */

export type MachineRunProcess =
  | "cut"
  | "bend"
  | "load"
  | "pickup"
  | "delivery"
  | "clearance"
  | "other";

export type MachineRunStatus =
  | "queued"
  | "running"
  | "paused"
  | "blocked"
  | "completed"
  | "rejected"
  | "canceled";

/** Row returned by SELECT */
export interface MachineRun {
  id: string;
  company_id: string;
  work_order_id: string | null;
  machine_id: string;
  operator_profile_id: string | null;
  supervisor_profile_id: string | null;
  process: MachineRunProcess;
  status: MachineRunStatus;
  started_at: string | null;
  ended_at: string | null;
  /** Generated column — read-only */
  duration_seconds: number | null;
  input_qty: number | null;
  output_qty: number | null;
  scrap_qty: number | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
}

/** Shape for INSERT (omit generated & defaulted fields) */
export interface MachineRunInsert {
  company_id: string;
  machine_id: string;
  process: MachineRunProcess;
  work_order_id?: string | null;
  operator_profile_id?: string | null;
  supervisor_profile_id?: string | null;
  status?: MachineRunStatus;
  started_at?: string | null;
  ended_at?: string | null;
  input_qty?: number | null;
  output_qty?: number | null;
  scrap_qty?: number | null;
  notes?: string | null;
  created_by?: string | null;
}

/** Shape for UPDATE (all fields optional) */
export interface MachineRunUpdate {
  company_id?: string;
  machine_id?: string;
  work_order_id?: string | null;
  operator_profile_id?: string | null;
  supervisor_profile_id?: string | null;
  process?: MachineRunProcess;
  status?: MachineRunStatus;
  started_at?: string | null;
  ended_at?: string | null;
  input_qty?: number | null;
  output_qty?: number | null;
  scrap_qty?: number | null;
  notes?: string | null;
  created_by?: string | null;
}
