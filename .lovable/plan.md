

## Plan: Fix Optimization Panel and Right-Side Overflow

### Problem 1: Optimization panel shows "Optimization ready" toast but no plan cards are visible
The `handleStartOptimize` runs optimization with the default config mode but never sets `selectedOptMode`, so the mode cards show no results. The optimization runs once but results only display when a mode card is clicked. The panel appears but all three cards are empty — user must click one to see results.

**Fix**: Auto-select "best-fit" as the default mode and pre-compute all three mode results so the cards show comparison data immediately.

### Problem 2: Content leaks to the right side
The table container has `min-w-[1400px]` inside a `div` with `overflow-auto` at `h-[55vh]`, but horizontal overflow isn't properly contained by the parent `max-w-full overflow-hidden` wrapper because the table's parent chain doesn't constrain width.

**Fix**: Wrap the table's scrollable container with `overflow-x-auto` and ensure the parent uses `w-0 min-w-full` or `overflow-hidden` to prevent horizontal bleed.

### Changes

**`src/components/office/AIExtractView.tsx`**

1. In `handleStartOptimize`: after running optimization, also set `setSelectedOptMode("best-fit")` so the best-fit card auto-selects and shows results immediately.

2. Pre-compute all three mode summaries so each card shows its stats without requiring a click:
   - Run `runOptimization` for all 3 modes in `handleStartOptimize`
   - Store results in a new state `allModeResults: Record<string, OptimizationSummary>`
   - Each card shows its own stats from `allModeResults[mode]`
   - Clicking a card still sets `selectedOptMode` for the highlight ring

3. Fix right-side overflow: change the table container `div` from `h-[55vh] overflow-auto` to `h-[55vh] overflow-auto max-w-full` and ensure the outer wrapper constrains properly.

### Files Modified
- `src/components/office/AIExtractView.tsx`

