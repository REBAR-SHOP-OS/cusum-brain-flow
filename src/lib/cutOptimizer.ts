/**
 * 1D Cut Optimization Engine
 * Implements First Fit Decreasing (FFD) bin-packing for rebar stock cutting.
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

export interface StockBar {
  stockLengthMm: number;
  cuts: { mark: string; lengthMm: number }[];
  remainderMm: number;
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
}

export interface OptimizationSummary {
  results: OptimizationResult[];
  totalStockBars: number;
  totalCuts: number;
  totalWasteKg: number;
  totalUsedKg: number;
  overallEfficiency: number;
  totalStopperMoves: number;
}

/**
 * Expand cut items by quantity into individual pieces
 */
function expandItems(items: CutItem[]): { mark: string; lengthMm: number; barSize: string }[] {
  const expanded: { mark: string; lengthMm: number; barSize: string }[] = [];
  for (const item of items) {
    for (let i = 0; i < item.quantity; i++) {
      expanded.push({
        mark: item.mark,
        lengthMm: item.lengthMm,
        barSize: item.barSize,
      });
    }
  }
  return expanded;
}

/**
 * Standard cutting: items in their original order, packed sequentially
 */
function standardCut(pieces: { mark: string; lengthMm: number }[], stockLengthMm: number): StockBar[] {
  const bars: StockBar[] = [];
  let currentBar: StockBar | null = null;

  for (const piece of pieces) {
    if (piece.lengthMm > stockLengthMm) continue; // Skip oversized

    if (!currentBar || currentBar.remainderMm < piece.lengthMm) {
      currentBar = { stockLengthMm, cuts: [], remainderMm: stockLengthMm };
      bars.push(currentBar);
    }
    currentBar.cuts.push({ mark: piece.mark, lengthMm: piece.lengthMm });
    currentBar.remainderMm -= piece.lengthMm;
  }

  return bars;
}

/**
 * Optimized cutting: First Fit Decreasing bin-packing
 */
function optimizedCut(pieces: { mark: string; lengthMm: number }[], stockLengthMm: number): StockBar[] {
  // Sort descending by length
  const sorted = [...pieces].sort((a, b) => b.lengthMm - a.lengthMm);
  const bars: StockBar[] = [];

  for (const piece of sorted) {
    if (piece.lengthMm > stockLengthMm) continue;

    // Find first bar with enough space
    let placed = false;
    for (const bar of bars) {
      if (bar.remainderMm >= piece.lengthMm) {
        bar.cuts.push({ mark: piece.mark, lengthMm: piece.lengthMm });
        bar.remainderMm -= piece.lengthMm;
        placed = true;
        break;
      }
    }

    if (!placed) {
      const newBar: StockBar = { stockLengthMm, cuts: [], remainderMm: stockLengthMm };
      newBar.cuts.push({ mark: piece.mark, lengthMm: piece.lengthMm });
      newBar.remainderMm -= piece.lengthMm;
      bars.push(newBar);
    }
  }

  return bars;
}

/**
 * Count stopper moves (number of distinct cut lengths across all bars)
 */
function countStopperMoves(bars: StockBar[]): number {
  const uniqueLengths = new Set<number>();
  for (const bar of bars) {
    for (const cut of bar.cuts) {
      uniqueLengths.add(cut.lengthMm);
    }
  }
  return uniqueLengths.size;
}

/**
 * Build an optimization result for a bar size group
 */
function buildResult(
  barSize: string,
  stockLengthMm: number,
  bars: StockBar[],
): OptimizationResult {
  const totalCuts = bars.reduce((s, b) => s + b.cuts.length, 0);
  const totalStockMm = bars.length * stockLengthMm;
  const totalUsedMm = bars.reduce((s, b) => s + b.cuts.reduce((cs, c) => cs + c.lengthMm, 0), 0);
  const totalWasteMm = totalStockMm - totalUsedMm;
  const massPerMm = (MASS_KG_PER_M[barSize] || 0) / 1000;
  const wasteKg = totalWasteMm * massPerMm;
  const efficiency = totalStockMm > 0 ? (totalUsedMm / totalStockMm) * 100 : 0;

  return {
    barSize,
    stockLengthMm,
    bars,
    totalStockBars: bars.length,
    totalCuts,
    totalStockMm,
    totalUsedMm,
    totalWasteMm,
    wasteKg,
    efficiency,
    stopperMoves: countStopperMoves(bars),
  };
}

/**
 * Run optimization on a list of cut items
 */
export function runOptimization(
  items: CutItem[],
  stockLengthMm: number,
  mode: "standard" | "optimized",
): OptimizationSummary {
  // Group by bar size
  const bySize = new Map<string, { mark: string; lengthMm: number }[]>();
  const expanded = expandItems(items);

  for (const piece of expanded) {
    if (!bySize.has(piece.barSize)) bySize.set(piece.barSize, []);
    bySize.get(piece.barSize)!.push({ mark: piece.mark, lengthMm: piece.lengthMm });
  }

  const results: OptimizationResult[] = [];

  for (const [barSize, pieces] of bySize) {
    const bars = mode === "optimized"
      ? optimizedCut(pieces, stockLengthMm)
      : standardCut(pieces, stockLengthMm);

    results.push(buildResult(barSize, stockLengthMm, bars));
  }

  // Sort by bar size
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

  return {
    results,
    totalStockBars,
    totalCuts,
    totalWasteKg,
    totalUsedKg,
    overallEfficiency,
    totalStopperMoves,
  };
}
