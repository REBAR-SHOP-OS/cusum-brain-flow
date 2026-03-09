

# Add "Manual (No Optimization)" Mode

## What
Add a 4th cutting mode called **"Manual"** that performs no bin-packing optimization. Each piece gets its own stock bar (1 cut per bar), letting the supervisor decide the cutting order piece by piece on the shop floor.

## How

### 1. Update `src/lib/cutOptimizer.ts`
- Add `"manual"` to the `OptimizerConfig.mode` union type: `"manual" | "standard" | "optimized" | "best-fit"`
- Add a `manualCut()` function that places each piece on its own individual stock bar (1 piece = 1 bar, no packing)
- Wire it into `runOptimization` with a new case for `"manual"`

### 2. Update `src/components/office/AIExtractView.tsx`
- Add `"manual"` to the pre-computed modes array (line ~445)
- Add a 4th mode card in the grid (line ~1521): change grid from `sm:grid-cols-3` → `sm:grid-cols-4`
- Card label: **"Manual"**, description: **"No optimization — supervisor picks order"**
- Show same stats (stock bars, efficiency, waste, stopper moves) for comparison

### Files Changed
| File | Change |
|------|--------|
| `src/lib/cutOptimizer.ts` | Add `"manual"` mode type + `manualCut()` function |
| `src/components/office/AIExtractView.tsx` | Add manual mode to pre-compute list + add 4th mode card |

