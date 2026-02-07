export type MachineType = "cutter" | "bender" | "loader" | "other";
export type MachineStatus = "idle" | "running" | "blocked" | "down";
export type CapabilityProcess = "cut" | "bend" | "load" | "other";

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

/** Canonical RSIC Canada rebar size reference */
export interface RebarSize {
  bar_code: string;       // '10M', '15M', ... '55M'
  diameter_mm: number;
  area_mm2: number;
  mass_kg_per_m: number;
  standard: string;       // 'RSIC-Canada-2017'
}

/** What a machine can process — keyed on bar_code, NOT mm */
export interface MachineCapability {
  id: string;
  machine_id: string;
  bar_code: string;       // FK → rebar_sizes.bar_code
  bar_mm: number | null;  // legacy/debug only — auto-populated from rebar_sizes
  process: CapabilityProcess;
  max_bars: number;
  max_length_mm: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
