/**
 * Imperial cut-math — pure inch arithmetic.
 *
 * All inputs and outputs are expressed in **inches**. No conversion to/from mm
 * happens in this module. Storage column `cut_length_mm` is misnamed — for
 * imperial rows it stores inches, and this module assumes that.
 */

export const REMNANT_THRESHOLD_IN = 12; // 1' minimum to qualify as a remnant

export interface RunPlanImperialInput {
  stockIn: number;
  cutIn: number;
  remainingPieces: number;
  maxBars: number;
}

export interface RunPlanImperialResult {
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

export function piecesPerBarImperial(stockIn: number, cutIn: number): number {
  if (!isFinite(stockIn) || !isFinite(cutIn) || cutIn <= 0) return 0;
  return Math.floor(stockIn / cutIn);
}

export function computeRunPlanImperial(input: RunPlanImperialInput): RunPlanImperialResult {
  const { stockIn, cutIn, remainingPieces, maxBars } = input;
  const piecesPerBar = piecesPerBarImperial(stockIn, cutIn);

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

  const remnantPerFullBar = stockIn - piecesPerBar * cutIn;
  const lastBarRemnant = lastBarPieces > 0 ? stockIn - lastBarPieces * cutIn : 0;

  let expectedRemnantBars = 0;
  let expectedScrapBars = 0;
  if (remnantPerFullBar >= REMNANT_THRESHOLD_IN) expectedRemnantBars += fullBars;
  else if (remnantPerFullBar > 0) expectedScrapBars += fullBars;
  if (lastBarPieces > 0) {
    if (lastBarRemnant >= REMNANT_THRESHOLD_IN) expectedRemnantBars += 1;
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

/** Format a length in inches as feet/inches (e.g. 96 → "8'", 66 → "5'-6\"", 6.5 → "6½\""). */
export function formatLengthImperial(totalInches: number): string {
  if (!isFinite(totalInches)) return `${totalInches}`;
  const sign = totalInches < 0 ? "-" : "";
  const abs = Math.abs(totalInches);
  const feet = Math.floor(abs / 12);
  const rem = abs - feet * 12;

  // Round to nearest 1/8"
  const eighths = Math.round(rem * 8);
  const wholeInches = Math.floor(eighths / 8);
  const fracEighths = eighths % 8;
  const fractionMap: Record<number, string> = {
    0: "", 1: "⅛", 2: "¼", 3: "⅜", 4: "½", 5: "⅝", 6: "¾", 7: "⅞",
  };
  const frac = fractionMap[fracEighths] || "";

  // If rounding pushes inches to 12, roll over
  let f = feet;
  let wi = wholeInches;
  if (wi === 12 && !frac) {
    f += 1;
    wi = 0;
  }

  if (f === 0) return `${sign}${wi}${frac}"`;
  if (wi === 0 && !frac) return `${sign}${f}'`;
  return `${sign}${f}'-${wi}${frac}"`;
}

/** Approximate weight in kg given length in inches and mass per metre (kg/m). */
export function weightKgImperial(lengthIn: number, kgPerMetre: number): number {
  return (lengthIn * 0.0254) * kgPerMetre;
}
