/**
 * LOCKED machine registry — maps DB model strings to assets + hard limits.
 * This file is the single source of truth for machine metadata displayed in the UI.
 * Actual enforcement lives in machine_capabilities table + manage-machine edge function.
 */

import dtx400Img from "@/assets/machines/dtx400.png";
import b36Img from "@/assets/machines/b36.png";
import b45Img from "@/assets/machines/b45.png";
import br18Img from "@/assets/machines/br18.png";
import spiralImg from "@/assets/machines/spiral.png";

export interface MachineSpec {
  image: string;
  label: string;
  purpose: string;
  operation: string;
  maxBarCode: string;
  /** Locked capacity table: bar_code → max bars per run */
  capacity: Record<string, number>;
  /** Bar codes explicitly blocked */
  blocked: string[];
  notes: string[];
}

/** Keyed by machines.model (DB column) */
export const MACHINE_REGISTRY: Record<string, MachineSpec> = {
  "GENSCO DTX 400": {
    image: dtx400Img,
    label: "DTX 400",
    purpose: "Straight cuts only",
    operation: "cut",
    maxBarCode: "35M",
    capacity: {
      "10M": 12,
      "15M": 12,
      "20M": 8,
      "25M": 6,
      "30M": 4,
      "35M": 1,
    },
    blocked: ["45M", "55M"],
    notes: [
      "No bending allowed",
      "No over-capacity batch cuts",
      "Scrap must be logged on completion",
      "Foot pedal / mechanical hold-down",
    ],
  },
  "GMS B36": {
    image: b36Img,
    label: "GMS B36",
    purpose: "Light–medium bending",
    operation: "bend",
    maxBarCode: "35M",
    capacity: {
      "10M": 6,
      "15M": 4,
      "20M": 2,
      "25M": 1,
      "30M": 1,
      "35M": 1,
    },
    blocked: ["45M", "55M"],
    notes: [
      "ASA Types: Light + some Heavy",
      "Radius ≥ code minimum",
      "No spirals",
    ],
  },
  "GMS B45": {
    image: b45Img,
    label: "GMS B45",
    purpose: "Heavy bending",
    operation: "bend",
    maxBarCode: "45M",
    capacity: {
      "10M": 6,
      "15M": 4,
      "20M": 3,
      "25M": 2,
      "30M": 1,
      "35M": 1,
      "45M": 1,
    },
    blocked: ["55M"],
    notes: [
      "ASA Types: ALL standard (1–32, S, T) except spiral",
      "Heavy bends allowed",
      "Multi-plane bends allowed",
    ],
  },
  "Rod Chomper BR18": {
    image: br18Img,
    label: "BR18",
    purpose: "Heavy / extreme bending",
    operation: "bend",
    maxBarCode: "55M",
    capacity: {
      "10M": 16,
      "15M": 12,
      "20M": 8,
      "25M": 6,
      "30M": 4,
      "35M": 2,
      "45M": 1,
      "55M": 1,
    },
    blocked: [],
    notes: [
      "ASA Types: ALL",
      "Heavy + multi-plane allowed",
      "Default for unknown / risky bends",
      "Single-bar only at high sizes",
    ],
  },
  "Circular Spiral Bender": {
    image: spiralImg,
    label: "Spiral",
    purpose: "Spirals, rings, continuous bends",
    operation: "spiral",
    maxBarCode: "20M",
    capacity: {
      "10M": 1,
      "15M": 1,
      "20M": 1,
    },
    blocked: ["25M", "30M", "35M", "45M", "55M"],
    notes: [
      "Spiral / circular ONLY",
      "No standard ASA straight shapes",
      "Radius must be provided",
      "25M+ BLOCKED until calibrated",
    ],
  },
};

export function getMachineSpec(model: string | null | undefined): MachineSpec | null {
  if (!model) return null;
  return MACHINE_REGISTRY[model] ?? null;
}
