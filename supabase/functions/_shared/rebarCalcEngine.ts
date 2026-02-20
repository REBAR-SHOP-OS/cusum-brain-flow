/**
 * Deterministic Rebar Calculation Engine
 * All formulas reference CSA G30.18 / RSIC 2018 standards.
 * No AI — pure TypeScript math from database standards.
 */

export interface RebarStandard {
  bar_size: string;
  bar_size_mm: number;
  weight_per_meter: number;
  area_mm2: number;
  lap_tension_mult: number;
  lap_compression_mult: number;
  development_length_mult: number;
  hook_90_extension_mult: number;
  hook_180_extension_mult: number;
  bend_radius_mult: number;
  hook_90_deduction: number | null;
  hook_180_deduction: number | null;
}

export interface EstimationPricing {
  bar_size: string;
  material_cost_per_kg: number;
  labor_rate_per_hour: number;
  kg_per_labor_hour: number;
}

export interface ValidationRule {
  rule_name: string;
  rule_type: string;
  element_type: string | null;
  min_value: number | null;
  max_value: number | null;
  unit: string | null;
  error_message: string | null;
  warning_message: string | null;
  severity: string;
  is_active: boolean;
}

export interface EstimationItemInput {
  element_type?: string;
  element_ref?: string;
  mark?: string;
  bar_size: string;
  grade?: string;
  shape_code?: string;
  quantity: number;
  cut_length_mm: number;
  hook_type_near?: "90" | "180" | "none";
  hook_type_far?: "90" | "180" | "none";
  lap_type?: "tension" | "compression" | "none";
  num_laps?: number;
  spacing_mm?: number;
  dimensions?: Record<string, number>;
}

export interface EstimationItemResult extends EstimationItemInput {
  hook_allowance_mm: number;
  lap_allowance_mm: number;
  total_length_mm: number;
  weight_kg: number;
  unit_cost: number;
  line_cost: number;
  warnings: string[];
}

// ─── Core Calculation Functions ───

export function computeHookAllowance(
  barSizeMm: number,
  hookType: "90" | "180" | "none"
): number {
  if (hookType === "none") return 0;
  // RSIC/CSA: 90° hook = 12d extension, 180° hook = 4d extension
  const mult = hookType === "90" ? 12 : 4;
  return barSizeMm * mult;
}

export function computeHookDeduction(
  std: RebarStandard,
  hookType: "90" | "180" | "none"
): number {
  if (hookType === "none") return 0;
  const deduction = hookType === "90" ? std.hook_90_deduction : std.hook_180_deduction;
  return deduction ?? 0;
}

export function computeLapSplice(
  barSizeMm: number,
  spliceType: "tension" | "compression" | "none",
  std: RebarStandard
): number {
  if (spliceType === "none") return 0;
  const mult = spliceType === "tension" ? std.lap_tension_mult : std.lap_compression_mult;
  return barSizeMm * mult;
}

export function computeDevelopmentLength(
  barSizeMm: number,
  std: RebarStandard
): number {
  return barSizeMm * std.development_length_mult;
}

export function computeBendDeduction(
  barSizeMm: number,
  std: RebarStandard
): number {
  return barSizeMm * std.bend_radius_mult;
}

export function computeBarWeight(
  lengthMm: number,
  weightPerMeter: number
): number {
  return (lengthMm / 1000) * weightPerMeter;
}

export function computeTotalLength(
  cutLengthMm: number,
  hookNearMm: number,
  hookFarMm: number,
  lapMm: number,
  hookDeductionNear: number,
  hookDeductionFar: number
): number {
  return cutLengthMm + hookNearMm + hookFarMm + lapMm - hookDeductionNear - hookDeductionFar;
}

export function computeLineCost(weightKg: number, materialCostPerKg: number): number {
  return weightKg * materialCostPerKg;
}

export function computeLaborHours(totalWeightKg: number, kgPerLaborHour: number): number {
  if (kgPerLaborHour <= 0) return 0;
  return totalWeightKg / kgPerLaborHour;
}

// ─── Item-Level Pipeline ───

export function calculateItem(
  input: EstimationItemInput,
  std: RebarStandard,
  pricing?: EstimationPricing
): EstimationItemResult {
  const hookNear = input.hook_type_near ?? "none";
  const hookFar = input.hook_type_far ?? "none";
  const lapType = input.lap_type ?? "none";
  const numLaps = input.num_laps ?? (lapType !== "none" ? 1 : 0);

  const hookNearMm = computeHookAllowance(std.bar_size_mm, hookNear);
  const hookFarMm = computeHookAllowance(std.bar_size_mm, hookFar);
  const hookDeductNear = computeHookDeduction(std, hookNear);
  const hookDeductFar = computeHookDeduction(std, hookFar);
  const lapPerSplice = computeLapSplice(std.bar_size_mm, lapType, std);
  const totalLapMm = lapPerSplice * numLaps;

  const hook_allowance_mm = hookNearMm + hookFarMm;
  const lap_allowance_mm = totalLapMm;

  const total_length_mm = computeTotalLength(
    input.cut_length_mm,
    hookNearMm, hookFarMm,
    totalLapMm,
    hookDeductNear, hookDeductFar
  );

  const weight_per_bar = computeBarWeight(total_length_mm, std.weight_per_meter);
  const weight_kg = weight_per_bar * input.quantity;

  const materialCost = pricing?.material_cost_per_kg ?? 0;
  const unit_cost = weight_per_bar * materialCost;
  const line_cost = weight_kg * materialCost;

  return {
    ...input,
    hook_allowance_mm: Math.round(hook_allowance_mm),
    lap_allowance_mm: Math.round(lap_allowance_mm),
    total_length_mm: Math.round(total_length_mm),
    weight_kg: Math.round(weight_kg * 1000) / 1000,
    unit_cost: Math.round(unit_cost * 100) / 100,
    line_cost: Math.round(line_cost * 100) / 100,
    warnings: [],
  };
}

// ─── Batch Operations ───

export function applyWasteFactor(
  items: EstimationItemResult[],
  wastePct: number
): EstimationItemResult[] {
  const factor = 1 + wastePct / 100;
  return items.map((item) => ({
    ...item,
    weight_kg: Math.round(item.weight_kg * factor * 1000) / 1000,
    line_cost: Math.round(item.line_cost * factor * 100) / 100,
  }));
}

export function computeProjectSummary(items: EstimationItemResult[]) {
  const totalWeight = items.reduce((s, i) => s + i.weight_kg, 0);
  const totalCost = items.reduce((s, i) => s + i.line_cost, 0);
  const elementSummary: Record<string, number> = {};
  for (const item of items) {
    const key = item.element_type ?? "unknown";
    elementSummary[key] = (elementSummary[key] ?? 0) + 1;
  }
  return {
    total_weight_kg: Math.round(totalWeight * 1000) / 1000,
    total_cost: Math.round(totalCost * 100) / 100,
    element_summary: elementSummary,
    item_count: items.length,
  };
}

// ─── Validation ───

export function validateItem(
  item: EstimationItemResult,
  rules: ValidationRule[]
): string[] {
  const warnings: string[] = [];
  for (const rule of rules) {
    if (!rule.is_active) continue;
    if (rule.element_type && rule.element_type !== item.element_type) continue;

    let value: number | undefined;
    if (rule.rule_type === "bar_size") value = undefined; // handled separately
    else if (rule.rule_type === "cut_length") value = item.cut_length_mm;
    else if (rule.rule_type === "spacing") value = item.spacing_mm;
    else if (rule.rule_type === "quantity") value = item.quantity;
    else if (rule.rule_type === "weight") value = item.weight_kg;

    if (value === undefined) continue;

    if (rule.min_value !== null && value < rule.min_value) {
      warnings.push(rule.warning_message ?? rule.error_message ?? `${rule.rule_name}: value ${value} below minimum ${rule.min_value}`);
    }
    if (rule.max_value !== null && value > rule.max_value) {
      warnings.push(rule.warning_message ?? rule.error_message ?? `${rule.rule_name}: value ${value} above maximum ${rule.max_value}`);
    }
  }
  return warnings;
}
