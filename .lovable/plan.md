

## Plan: Fix Source-Unit Storage Pipeline End-to-End

### Problem
Two issues:
1. **Mapping preview rounds decimals** — `Math.round()` at lines 216 and 232 in `BarlistMappingPanel.tsx` rounds 44.5 → 45
2. **Approve flow copies source-unit values into `cut_length_mm`** — 30+ shop floor files display this with "mm" suffix, so 44.5 inches shows as "44.5mm"

### Architecture Decision

Since the user wants source-unit values preserved throughout (no mm conversion anywhere), all downstream consumers must be aware of the unit. The `unit_system` from the session must propagate to `cut_plan_items`, `barlist_items`, and `production_tasks`.

```text
FLOW:
extract_rows.total_length_mm = 44.5 (inches)
    ↓ approve
barlist_items.cut_length_mm = 44.5 (inches)  
cut_plan_items.cut_length_mm = 44.5 (inches)
production_tasks.cut_length_mm = 44.5 (inches)
    ↓ display
Shop floor shows "44.5 in" (not "44.5mm")
```

### Changes

**1. `src/components/office/BarlistMappingPanel.tsx`** — Remove `Math.round()` on lines 216 and 232 to preserve decimal precision (44.5 stays 44.5).

**2. `supabase/functions/manage-extract/index.ts`** — In `approveExtract`, store `session.unit_system` on `cut_plan_items` and `barlist_items` so downstream knows the unit. Add `unit_system` field to the inserted records. (This requires a DB migration to add the column.)

**3. Database migration** — Add `unit_system text` column to:
- `cut_plan_items`
- `barlist_items`  
- `production_tasks`

Default: `'mm'` (backward compatible with existing data).

**4. Shop floor display files** — Update the ~6 files that hardcode "mm" suffix to read `unit_system` from the record:
- `src/pages/PoolView.tsx` (line 319)
- `src/pages/StationView.tsx` (line 526)
- `src/components/clearance/ClearanceCard.tsx` (line 309)
- `src/components/cutter/QueueToMachineDialog.tsx` (lines 115, 155)
- `src/hooks/useLiveMonitorStats.ts` (line 72) — weight calc needs unit-aware conversion to meters

**5. Weight calculation in `useLiveMonitorStats.ts`** — Currently does `cut_length_mm / 1000` to get meters. Must convert based on `unit_system` first.

**6. Edge function: `approveExtract`** — Pass `session.unit_system` into `barlist_items`, `cut_plan_items`, and `production_tasks` inserts.

**7. Redeploy** `manage-extract` edge function.

### What stays the same
- `extract_rows` storage logic — already correct (stores source values)
- Display logic in `AIExtractView.tsx` — already correct
- Optimizer `toMm` conversion — already correct
- `getWeight` in `RebarTagCard.tsx` / `TagsExportView.tsx` — already updated

### Risk
- Existing approved items in production have no `unit_system` column yet — the default `'mm'` ensures backward compatibility since all previously approved data was in mm.

