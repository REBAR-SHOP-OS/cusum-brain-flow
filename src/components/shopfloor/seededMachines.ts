import type { LiveMachine, MachineStatus, MachineType } from "@/types/machine";

const SEEDED_TIMESTAMP = "2026-05-05T00:00:00.000Z";
const SEEDED_COMPANY_ID = "seeded-shop-floor";

function buildSeededMachine(input: {
  id: string;
  name: string;
  model: string;
  type: MachineType;
  status: MachineStatus;
  process?: string | null;
}) : LiveMachine {
  return {
    id: input.id,
    company_id: SEEDED_COMPANY_ID,
    warehouse_id: null,
    name: input.name,
    model: input.model,
    type: input.type,
    status: input.status,
    current_run_id: input.status === "running" ? `${input.id.toLowerCase()}-run` : null,
    current_operator_profile_id: null,
    last_event_at: SEEDED_TIMESTAMP,
    created_at: SEEDED_TIMESTAMP,
    updated_at: SEEDED_TIMESTAMP,
    active_job_id: null,
    active_plan_id: null,
    cut_session_status: input.status === "running" ? "running" : "idle",
    job_assigned_by: null,
    machine_lock: false,
    operator: null,
    current_run:
      input.status === "running"
        ? {
            id: `${input.id.toLowerCase()}-run`,
            status: "running",
            process: input.process ?? input.type,
            started_at: SEEDED_TIMESTAMP,
            notes: "Seeded fabrication unit visible until live machine rows are synced.",
          }
        : null,
    queued_runs: [],
  };
}

export const SEEDED_MACHINE_IDS = new Set([
  "BENDER-01",
  "BENDER-02",
  "BENDER-03",
  "CUTTER-01",
  "CUTTER-02",
  "SPIRAL-01",
]);

export const SEEDED_FAB_MACHINES: LiveMachine[] = [
  buildSeededMachine({
    id: "BENDER-01",
    name: "BENDER-01",
    model: "GMS B36",
    type: "bender",
    status: "idle",
    process: "bend",
  }),
  buildSeededMachine({
    id: "BENDER-02",
    name: "BENDER-02",
    model: "GMS B45",
    type: "bender",
    status: "idle",
    process: "bend",
  }),
  buildSeededMachine({
    id: "BENDER-03",
    name: "BENDER-03",
    model: "Rod Chomper BR18",
    type: "bender",
    status: "idle",
    process: "bend",
  }),
  buildSeededMachine({
    id: "CUTTER-01",
    name: "CUTTER-01",
    model: "GENSCO DTX 400",
    type: "cutter",
    status: "running",
    process: "cut",
  }),
  buildSeededMachine({
    id: "CUTTER-02",
    name: "CUTTER-02",
    model: "GENSCO DTX 400",
    type: "cutter",
    status: "running",
    process: "cut",
  }),
  buildSeededMachine({
    id: "SPIRAL-01",
    name: "SPIRAL-01",
    model: "Circular Spiral Bender",
    type: "other",
    status: "idle",
    process: "spiral",
  }),
];

export function isSeededMachineId(machineId: string | null | undefined) {
  return Boolean(machineId && SEEDED_MACHINE_IDS.has(machineId));
}
