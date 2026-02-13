/**
 * 1D Cut Optimization Engine
 * Implements FFD, BFD, and Standard bin-packing for rebar stock cutting.
 * Accounts for kerf (blade width) and remnant thresholds.
 */

// Mass per meter by bar code (RSIC Canada)
export const MASS_KG_PER_M: Record<string, number> = {
  "10M": 0.785, "15M": 1.570, "20M": 2.355, "25M": 3.925,
  "30M": 5.495, "35M": 7.850, "45M": 11.775, "55M": 19.625,
};

export interface CutItem {
  id: string;
  mark: string;
  barSize: string;
  lengthMm: number;
  quantity: number;
  shapeType?: string;
}

export interface OptimizerConfig {
  stockLengthMm: number;
  kerfMm: number;          // blade width, default 5
  minRemnantMm: number;    // below this = scrap, default 300
  mode: "standard" | "optimized" | "best-fit";
}

export interface StockBar {
  stockLengthMm: number;
  cuts: { mark: string; lengthMm: number }[];
  remainderMm: number;
}

export interface SkippedPiece {
  mark: string;
  lengthMm: number;
  barSize: string;
}

export interface OptimizationResult {
  barSize: string;
  stockLengthMm: number;
  bars: StockBar[];
  totalStockBars: number;
  totalCuts: number;
  totalStockMm: number;
  totalUsedMm: number;
  totalWasteMm: number;
  wasteKg: number;
  efficiency: number;
  stopperMoves: number;
  skippedPieces: SkippedPiece[];
  usableRemnantCount: number;
  scrapCount: number;
}

export interface OptimizationSummary {
  results: OptimizationResult[];
  totalStockBars: number;
  totalCuts: number;
  totalWasteKg: number;
  totalUsedKg: number;
  overallEfficiency: number;
  totalStopperMoves: number;
  totalSkipped: number;
  totalUsableRemnants: number;
  totalScrap: number;
}

/** Expand cut items by quantity into individual pieces */
function expandItems(items: CutItem[]): { mark: string; lengthMm: number; barSize: string }[] {
  const expanded: { mark: string; lengthMm: number; barSize: string }[] = [];
  for (const item of items) {
    for (let i = 0; i < item.quantity; i++) {
      expanded.push({ mark: item.mark, lengthMm: item.lengthMm, barSize: item.barSize });
    }
  }
  return expanded;
}

/** Separate oversized pieces from valid ones */
function partitionPieces(
  pieces: { mark: string; lengthMm: number; barSize: string }[],
  stockLengthMm: number,
): {
  valid: { mark: string; lengthMm: number }[];
  skipped: SkippedPiece[];
} {
  const valid: { mark: string; lengthMm: number }[] = [];
  const skipped: SkippedPiece[] = [];
  for (const p of pieces) {
    if (p.lengthMm > stockLengthMm) {
      skipped.push({ mark: p.mark, lengthMm: p.lengthMm, barSize: p.barSize });
    } else {
      valid.push({ mark: p.mark, lengthMm: p.lengthMm });
    }
  }
  return { valid, skipped };
}

/**
 * Standard cutting: pieces sorted by length (groups same-length for fewer stopper moves),
 * packed sequentially with kerf allowance.
 */
function standardCut(
  pieces: { mark: string; lengthMm: number }[],
  stockLengthMm: number,
  kerfMm: number,
): StockBar[] {
  // Sort by length to group same-length cuts → fewer stopper moves
  const sorted = [...pieces].sort((a, b) => a.lengthMm - b.lengthMm);
  const bars: StockBar[] = [];
  let currentBar: StockBar | null = null;

  for (const piece of sorted) {
    const spaceNeeded = piece.lengthMm + kerfMm;

    if (!currentBar || currentBar.remainderMm < spaceNeeded) {
      currentBar = { stockLengthMm, cuts: [], remainderMm: stockLengthMm };
      bars.push(currentBar);
    }
    currentBar.cuts.push({ mark: piece.mark, lengthMm: piece.lengthMm });
    currentBar.remainderMm -= spaceNeeded;
  }

  // Correct: last cut on each bar doesn't need kerf after it
  for (const bar of bars) {
    if (bar.cuts.length > 0) bar.remainderMm += kerfMm;
  }

  return bars;
}

/**
 * First Fit Decreasing bin-packing with kerf allowance
 */
function optimizedCut(
  pieces: { mark: string; lengthMm: number }[],
  stockLengthMm: number,
  kerfMm: number,
): StockBar[] {
  const sorted = [...pieces].sort((a, b) => b.lengthMm - a.lengthMm);
  const bars: StockBar[] = [];

  for (const piece of sorted) {
    const spaceNeeded = piece.lengthMm + kerfMm;
    let placed = false;

    for (const bar of bars) {
      if (bar.remainderMm >= spaceNeeded) {
        bar.cuts.push({ mark: piece.mark, lengthMm: piece.lengthMm });
        bar.remainderMm -= spaceNeeded;
        placed = true;
        break;
      }
    }

    if (!placed) {
      const newBar: StockBar = { stockLengthMm, cuts: [], remainderMm: stockLengthMm };
      newBar.cuts.push({ mark: piece.mark, lengthMm: piece.lengthMm });
      newBar.remainderMm -= spaceNeeded;
      bars.push(newBar);
    }
  }

  // Last cut on each bar doesn't need kerf
  for (const bar of bars) {
    if (bar.cuts.length > 0) bar.remainderMm += kerfMm;
  }

  return bars;
}

/**
 * Best Fit Decreasing: picks the bar with the LEAST remaining space that still fits.
 * Often produces less waste than FFD.
 */
function bestFitCut(
  pieces: { mark: string; lengthMm: number }[],
  stockLengthMm: number,
  kerfMm: number,
): StockBar[] {
  const sorted = [...pieces].sort((a, b) => b.lengthMm - a.lengthMm);
  const bars: StockBar[] = [];

  for (const piece of sorted) {
    const spaceNeeded = piece.lengthMm + kerfMm;
    let bestBar: StockBar | null = null;
    let bestRemainder = Infinity;

    for (const bar of bars) {
      if (bar.remainderMm >= spaceNeeded) {
        const afterPlace = bar.remainderMm - spaceNeeded;
        if (afterPlace < bestRemainder) {
          bestRemainder = afterPlace;
          bestBar = bar;
        }
      }
    }

    if (bestBar) {
      bestBar.cuts.push({ mark: piece.mark, lengthMm: piece.lengthMm });
      bestBar.remainderMm -= spaceNeeded;
    } else {
      const newBar: StockBar = { stockLengthMm, cuts: [], remainderMm: stockLengthMm };
      newBar.cuts.push({ mark: piece.mark, lengthMm: piece.lengthMm });
      newBar.remainderMm -= spaceNeeded;
      bars.push(newBar);
    }
  }

  // Last cut on each bar doesn't need kerf
  for (const bar of bars) {
    if (bar.cuts.length > 0) bar.remainderMm += kerfMm;
  }

  return bars;
}

/** Count stopper moves (distinct cut lengths) */
function countStopperMoves(bars: StockBar[]): number {
  const uniqueLengths = new Set<number>();
  for (const bar of bars) {
    for (const cut of bar.cuts) uniqueLengths.add(cut.lengthMm);
  }
  return uniqueLengths.size;
}

/** Classify remainders into usable remnants vs scrap */
function classifyRemainders(bars: StockBar[], minRemnantMm: number) {
  let usableRemnantCount = 0;
  let scrapCount = 0;
  for (const bar of bars) {
    if (bar.remainderMm >= minRemnantMm) usableRemnantCount++;
    else if (bar.remainderMm > 0) scrapCount++;
  }
  return { usableRemnantCount, scrapCount };
}

/** Build an optimization result for a bar size group */
function buildResult(
  barSize: string,
  stockLengthMm: number,
  bars: StockBar[],
  skippedPieces: SkippedPiece[],
  minRemnantMm: number,
): OptimizationResult {
  const totalCuts = bars.reduce((s, b) => s + b.cuts.length, 0);
  const totalStockMm = bars.length * stockLengthMm;
  const totalUsedMm = bars.reduce((s, b) => s + b.cuts.reduce((cs, c) => cs + c.lengthMm, 0), 0);
  const totalWasteMm = totalStockMm - totalUsedMm;
  const massPerMm = (MASS_KG_PER_M[barSize] || 0) / 1000;
  const wasteKg = totalWasteMm * massPerMm;
  const efficiency = totalStockMm > 0 ? (totalUsedMm / totalStockMm) * 100 : 0;
  const { usableRemnantCount, scrapCount } = classifyRemainders(bars, minRemnantMm);

  return {
    barSize, stockLengthMm, bars,
    totalStockBars: bars.length, totalCuts, totalStockMm, totalUsedMm, totalWasteMm,
    wasteKg, efficiency,
    stopperMoves: countStopperMoves(bars),
    skippedPieces: skippedPieces.filter(s => s.barSize === barSize),
    usableRemnantCount, scrapCount,
  };
}

/** Run optimization on a list of cut items */
export function runOptimization(
  items: CutItem[],
  config: OptimizerConfig,
): OptimizationSummary {
  const { stockLengthMm, kerfMm, minRemnantMm, mode } = config;
  const expanded = expandItems(items);

  // Group by bar size
  const bySize = new Map<string, { mark: string; lengthMm: number; barSize: string }[]>();
  for (const piece of expanded) {
    if (!bySize.has(piece.barSize)) bySize.set(piece.barSize, []);
    bySize.get(piece.barSize)!.push(piece);
  }

  const results: OptimizationResult[] = [];

  for (const [barSize, pieces] of bySize) {
    const { valid, skipped } = partitionPieces(pieces, stockLengthMm);

    const bars = mode === "best-fit"
      ? bestFitCut(valid, stockLengthMm, kerfMm)
      : mode === "optimized"
        ? optimizedCut(valid, stockLengthMm, kerfMm)
        : standardCut(valid, stockLengthMm, kerfMm);

    results.push(buildResult(barSize, stockLengthMm, bars, skipped, minRemnantMm));
  }

  results.sort((a, b) => a.barSize.localeCompare(b.barSize));

  const totalStockBars = results.reduce((s, r) => s + r.totalStockBars, 0);
  const totalCuts = results.reduce((s, r) => s + r.totalCuts, 0);
  const totalWasteKg = results.reduce((s, r) => s + r.wasteKg, 0);
  const totalUsedMm = results.reduce((s, r) => s + r.totalUsedMm, 0);
  const totalStockMm = results.reduce((s, r) => s + r.totalStockMm, 0);
  const totalUsedKg = results.reduce((s, r) => {
    const massPerMm = (MASS_KG_PER_M[r.barSize] || 0) / 1000;
    return s + r.totalUsedMm * massPerMm;
  }, 0);
  const overallEfficiency = totalStockMm > 0 ? (totalUsedMm / totalStockMm) * 100 : 0;
  const totalStopperMoves = results.reduce((s, r) => s + r.stopperMoves, 0);
  const totalSkipped = results.reduce((s, r) => s + r.skippedPieces.length, 0);
  const totalUsableRemnants = results.reduce((s, r) => s + r.usableRemnantCount, 0);
  const totalScrap = results.reduce((s, r) => s + r.scrapCount, 0);

  return {
    results, totalStockBars, totalCuts, totalWasteKg, totalUsedKg,
    overallEfficiency, totalStopperMoves, totalSkipped, totalUsableRemnants, totalScrap,
  };
}
