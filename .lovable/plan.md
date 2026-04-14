

## Plan: First-Fit Decreasing Cutting Stock Algorithm for Order Calculator

### Problem
The current `calculate()` function divides total length by stock length (`Math.ceil(withWaste * 1000 / stockMm)`). This overestimates because it ignores that remnants from one stock bar can fit smaller cuts. A First-Fit Decreasing (FFD) bin-packing algorithm will yield accurate results.

### Algorithm
For each bar size independently:
1. Expand parsed items into individual cut lengths (respecting quantity), applying waste factor per-piece
2. Sort cuts longest → shortest
3. Iterate: for each cut, find the first open stock bar with enough remaining length; if none, open a new bar
4. Count of opened bars = bars to order

### Changes

**`src/components/office/OrderCalcView.tsx`**

Replace the `calculate()` function (lines 27-63) with an FFD-based version:

```typescript
function calculate(
  items: ParsedItem[],
  stockLengthM: number,
  wastePct: number,
  wpm: Record<string, number>,
  unitFactor: number = 1
): SizeSummary[] {
  const stockMm = stockLengthM * 1000;
  const wasteMult = 1 + wastePct / 100;
  const sizes = ["10M", "15M", "20M", "25M", "30M", "35M"];

  // Group items by bar size
  const grouped: Record<string, { pieces: number; cuts_mm: number[] }> = {};
  for (const it of items) {
    if (!grouped[it.bar_size]) grouped[it.bar_size] = { pieces: 0, cuts_mm: [] };
    const cutMm = it.cut_length_mm * unitFactor * wasteMult;
    grouped[it.bar_size].pieces += it.quantity;
    for (let i = 0; i < it.quantity; i++) {
      grouped[it.bar_size].cuts_mm.push(cutMm);
    }
  }

  return sizes.filter(s => grouped[s]).map(s => {
    const g = grouped[s];
    // FFD bin packing
    const cuts = g.cuts_mm.sort((a, b) => b - a); // longest first
    const bins: number[] = []; // remaining space per bin
    for (const cut of cuts) {
      let placed = false;
      for (let j = 0; j < bins.length; j++) {
        if (bins[j] >= cut) {
          bins[j] -= cut;
          placed = true;
          break;
        }
      }
      if (!placed) {
        bins.push(stockMm - cut);
      }
    }
    const bars = bins.length;
    const totalM = g.cuts_mm.reduce((a, b) => a + b, 0) / wasteMult / 1000;
    const withWasteM = g.cuts_mm.reduce((a, b) => a + b, 0) / 1000;
    const w = wpm[s] ?? FALLBACK_WPM[s] ?? 0;
    const weight = Math.round(bars * stockLengthM * w * 100) / 100;

    return {
      bar_size: s,
      total_pieces: g.pieces,
      total_length_m: Math.round(totalM * 100) / 100,
      length_with_waste_m: Math.round(withWasteM * 100) / 100,
      bars_to_order: bars,
      total_weight_kg: weight,
    };
  });
}
```

### Key Differences
- **Before**: `bars = ceil(totalLength / stockLength)` — treats all cuts as continuous material
- **After**: Each individual cut piece is placed into stock bars using FFD — remnants are reused for shorter cuts, yielding fewer bars

### Scope
Single file change: `src/components/office/OrderCalcView.tsx` — only the `calculate` function is replaced. No other files affected.

