

# Fix: Manual Mode — No Jumping Between Items

## Understanding
"Manual" mode means: cut normally (e.g. 3 pcs/bar), but **stay on the current item until it's 100% done**. No auto-advancing to the next queue item. The supervisor controls navigation.

Currently the system auto-advances to the next item at line 486 regardless of mode. The mode selection is also not persisted to the database, so the station has no way to know which mode was chosen.

## Changes

### 1. Database Migration
Add `optimization_mode` column to `cut_plans`:
```sql
ALTER TABLE public.cut_plans ADD COLUMN optimization_mode text DEFAULT 'best-fit';
```

### 2. Edge Function (`supabase/functions/manage-extract/index.ts`)
- Save `optimizerConfig.selectedMode` into `cut_plans.optimization_mode` when creating the plan (line ~554)
- Keep `piecesPerBar` calculation unchanged (Manual mode still uses normal pcs/bar math)

### 3. Station Data Hook (`src/hooks/useStationData.ts`)
- Add `optimization_mode` to the `cut_plans` join select
- Add `optimization_mode` to `StationItem` interface

### 4. Station UI (`src/components/shopfloor/CutterStationView.tsx`)
- Read `currentItem.optimization_mode` from the data
- **Disable auto-advance** (line 486-490) when `optimization_mode === "manual"` — instead of jumping to next item, show "Mark complete — start next run" and let the operator stay on the same item or manually navigate
- When mark IS fully complete in manual mode, show a "Move to next" button instead of auto-advancing

### 5. Fix `manualCut()` in `cutOptimizer.ts`
Update the `manualCut` function to use normal pcs/bar packing (same as standard) instead of 1-piece-per-bar, since manual mode just means "no jumping" not "no packing". The comparison stats will then show the same bar count but highlight the difference is in workflow control.

## Files Changed
| File | Change |
|------|--------|
| Migration SQL | Add `optimization_mode` column |
| `supabase/functions/manage-extract/index.ts` | Save selected mode to cut_plans |
| `src/hooks/useStationData.ts` | Include `optimization_mode` in query + type |
| `src/components/shopfloor/CutterStationView.tsx` | Disable auto-advance for manual mode |
| `src/lib/cutOptimizer.ts` | Update `manualCut()` to use normal packing |

