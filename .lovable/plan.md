

# Replace Old Optimization Modes with New Strategy System

## Problem
Two optimization naming systems coexist:
- **Old** (in cutOptimizer, OptimizationView, AIExtractView optimization panel): `manual`, `standard`, `optimized`, `best-fit`
- **New** (in AIExtractView strategy step only): `raw`, `long_to_short`, `combination`

## Strategy Mapping
| Old Mode | New Strategy | Algorithm | Label |
|----------|-------------|-----------|-------|
| `manual` / `standard` | `raw` | Sequential, no bin-packing | RAW |
| `optimized` (FFD) | `long_to_short` | First Fit Decreasing | LONG → SHORT |
| `best-fit` (BFD) | `combination` | Best Fit Decreasing | COMBINATION |

## Files to Change

### 1. `src/lib/cutOptimizer.ts` — Core engine
- Change `OptimizerConfig.mode` type from `"manual" | "standard" | "optimized" | "best-fit"` to `"raw" | "long_to_short" | "combination"`
- Map `raw` → `standardCut`, `long_to_short` → `optimizedCut`, `combination` → `bestFitCut`
- Keep internal algorithm functions unchanged (no domino effect)

### 2. `src/components/office/OptimizationView.tsx` — Standalone optimization page
- 3 cards instead of 3: RAW, LONG → SHORT, COMBINATION
- Update variable names: `standardResult` → `rawResult`, `optimizedResult` → `longToShortResult`, `bestFitResult` → `combinationResult`
- Update labels, icons, savings banner text

### 3. `src/components/office/AIExtractView.tsx` — Extract pipeline
- Line 157: default mode `"best-fit"` → `"combination"`
- Line 584: modes array → `["raw", "long_to_short", "combination"]`
- Lines 591-593: auto-select → `"combination"`
- Lines 2041-2046: mode cards → RAW / LONG → SHORT / COMBINATION labels
- Line 546: selectedMode default → `"combination"`

### 4. `supabase/functions/manage-extract/index.ts` — Edge function
- Line 797: default mode `"best-fit"` → `"combination"`

### 5. `src/components/office/TagsExportView.tsx` — Sort toggle
- Rename sort labels from "Standard" / "Optimized" to "Raw" / "Optimized"

### 6. `src/components/shopfloor/CutterStationView.tsx` — Auto-advance guard
- Line 531: `"manual"` → `"raw"` check for supervisor-controlled mode

### 7. `src/test/phase4.test.ts` — Tests already use new names, no change needed

## Safety Guards
- Internal algorithm functions (`standardCut`, `optimizedCut`, `bestFitCut`) are NOT renamed — only the routing in `runOptimization` changes
- DB column `optimization_mode` stays as-is (string column, no enum constraint)
- Existing DB records with old values will still render (add fallback mapping in CutterStationView)

