/**
 * Cut-math dispatcher — routes to imperial or metric module based on unit_system.
 *
 * NEVER converts between units. Each pipeline is unit-locked end-to-end.
 *
 * `unit_system` values that map to imperial: "in", "ft", "imperial", "ft-in".
 * Anything else (including null/undefined) is treated as metric (mm).
 */

import * as I from "./imperial";
import * as M from "./metric";

export { REMNANT_THRESHOLD_IN } from "./imperial";
export { REMNANT_THRESHOLD_MM } from "./metric";

export type UnitTag = string | null | undefined;

export function isImperial(unit: UnitTag): boolean {
  if (!unit) return false;
  const u = unit.toLowerCase();
  return u === "in" || u === "ft" || u === "imperial" || u === "ft-in";
}

export function piecesPerBar(stock: number, cut: number, unit: UnitTag): number {
  return isImperial(unit)
    ? I.piecesPerBarImperial(stock, cut)
    : M.piecesPerBarMetric(stock, cut);
}

export function remnantThreshold(unit: UnitTag): number {
  return isImperial(unit) ? I.REMNANT_THRESHOLD_IN : M.REMNANT_THRESHOLD_MM;
}

export function formatLength(value: number, unit: UnitTag): string {
  return isImperial(unit) ? I.formatLengthImperial(value) : M.formatLengthMetric(value);
}

export function weightKg(length: number, kgPerMetre: number, unit: UnitTag): number {
  return isImperial(unit)
    ? I.weightKgImperial(length, kgPerMetre)
    : M.weightKgMetric(length, kgPerMetre);
}

export interface RunPlanCommon {
  piecesPerBar: number;
  totalBarsNeeded: number;
  fullBars: number;
  lastBarPieces: number;
  remnantPerFullBar: number;
  lastBarRemnant: number;
  expectedRemnantBars: number;
  expectedScrapBars: number;
  feasible: boolean;
  barsThisRun: number;
}

export function computeRunPlan(args: {
  stock: number;
  cut: number;
  remainingPieces: number;
  maxBars: number;
  unit: UnitTag;
}): RunPlanCommon {
  if (isImperial(args.unit)) {
    return I.computeRunPlanImperial({
      stockIn: args.stock,
      cutIn: args.cut,
      remainingPieces: args.remainingPieces,
      maxBars: args.maxBars,
    });
  }
  return M.computeRunPlanMetric({
    stockMm: args.stock,
    cutMm: args.cut,
    remainingPieces: args.remainingPieces,
    maxBars: args.maxBars,
  });
}
