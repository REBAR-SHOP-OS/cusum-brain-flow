

# Fix: Dynamic Max Bars Based on Cut Length

## Problem
The "Bars to Load" control allows loading up to the static `max_bars` from `machine_capabilities` (e.g., 8 for DTX 400 + 20M), regardless of how long the part is. Physically, longer parts take more space on the machine bed, so fewer bars can be loaded simultaneously. The screenshot shows 6 bars for a 2395mm cut — which may exceed the machine's physical capacity for that part length.

## Root Cause
`maxBars` is set purely from `machine_capabilities.max_bars` (keyed on bar_code), with no reduction based on `cut_length_mm`. The foreman brain's `computeRunPlan` receives this static `maxBars` and caps `barsThisRun` to it.

## Solution
Add a dynamic max-bars calculation that reduces the allowed bar count for longer parts. The formula uses the stock length and cut length to determine an effective limit:

**Rule**: For each bar loaded, the total occupied bed length increases. If `cut_length_mm > stockLength / 2` (i.e., only 1-2 pieces per bar), the bar takes up significant space. We cap bars based on a physical bed-length constant per machine.

Since we already have `max_length_mm` on `machine_capabilities` (currently nullable/unused), we can use it as the machine's effective bed capacity in mm. If not set, fall back to the static `max_bars`.

### Changes

**1. `src/components/shopfloor/CutterStationView.tsx`** (~line 120)
Change `maxBars` calculation to factor in cut length:
```typescript
const staticMaxBars = currentItem ? (getMaxBars(currentItem.bar_code) || 10) : 10;
// Dynamic reduction: if cut length is long relative to stock, reduce max bars
const maxBars = currentItem 
  ? Math.max(1, Math.min(staticMaxBars, Math.floor(selectedStockLength / currentItem.cut_length_mm)))
  : staticMaxBars;
```
This uses `floor(stockLength / cutLength)` as an upper physical bound — essentially "how many pieces fit in one stock length" also limits how many bars can be practically managed. For a 2395mm cut on 12M stock: `floor(12000/2395) = 5`, so max bars = min(8, 5) = **5 bars**.

**2. `src/lib/foremanBrain.ts`** (~line 217)
The `computeRunPlan` already receives `maxBars` and caps `barsThisRun` to it — no change needed here since the caller will pass the already-reduced value.

**3. `src/components/shopfloor/CutEngine.tsx`**
The `maxBars` prop is already passed from CutterStationView and controls the up/down buttons — no change needed.

## Summary
Single-line change in `CutterStationView.tsx`: dynamically reduce `maxBars` using `floor(stockLength / cutLength)` so longer parts automatically limit how many bars can be loaded. This is a conservative, physics-based limit that prevents overloading.

