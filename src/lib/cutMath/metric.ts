/**
 * Metric cut-math — pure millimetre arithmetic.
 *
 * All inputs and outputs are expressed in **millimetres**. No conversion to
 * inches happens in this module.
 */

export const REMNANT_THRESHOLD_MM = 300; // 30 cm minimum to qualify as a remnant

export interface RunPlanMetricInput {
  stockMm: number;
  cutMm: number;
  remainingPieces: number;
  maxBars: number;
}

export interface RunPlanMetricResult {
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

export function piecesPerBarMetric(stockMm: number, cutMm: number): number {
  if (!isFinite(stockMm) || !isFinite(cutMm) || cutMm <= 0) return 0;
  return Math.floor(stockMm / cutMm);
}

export function computeRunPlanMetric(input: RunPlanMetricInput): RunPlanMetricResult {
  const { stockMm, cutMm, remainingPieces, maxBars } = input;
  const piecesPerBar = piecesPerBarMetric(stockMm, cutMm);

  if (piecesPerBar <= 0 || remainingPieces <= 0) {
    return {
      piecesPerBar, totalBarsNeeded: 0, fullBars: 0, lastBarPieces: 0,
      remnantPerFullBar: 0, lastBarRemnant: 0,
      expectedRemnantBars: 0, expectedScrapBars: 0,
      feasible: false, barsThisRun: 0,
    };
  }

  const totalBarsNeeded = Math.ceil(remainingPieces / piecesPerBar);
  const fullBars = Math.floor(remainingPieces / piecesPerBar);
  const lastBarPieces = remainingPieces % piecesPerBar;

  const remnantPerFullBar = stockMm - piecesPerBar * cutMm;
  const lastBarRemnant = lastBarPieces > 0 ? stockMm - lastBarPieces * cutMm : 0;

  let expectedRemnantBars = 0;
  let expectedScrapBars = 0;
  if (remnantPerFullBar >= REMNANT_THRESHOLD_MM) expectedRemnantBars += fullBars;
  else if (remnantPerFullBar > 0) expectedScrapBars += fullBars;
  if (lastBarPieces > 0) {
    if (lastBarRemnant >= REMNANT_THRESHOLD_MM) expectedRemnantBars += 1;
    else if (lastBarRemnant > 0) expectedScrapBars += 1;
  }

  const barsThisRun = Math.min(totalBarsNeeded, maxBars);

  return {
    piecesPerBar, totalBarsNeeded, fullBars, lastBarPieces,
    remnantPerFullBar, lastBarRemnant,
    expectedRemnantBars, expectedScrapBars,
    feasible: barsThisRun > 0, barsThisRun,
  };
}

export function formatLengthMetric(mm: number): string {
  if (!isFinite(mm)) return `${mm}`;
  return `${Math.round(mm)} mm`;
}

export function weightKgMetric(lengthMm: number, kgPerMetre: number): number {
  return (lengthMm / 1000) * kgPerMetre;
}
