

# Unit System: Metric (MM) vs Imperial (FT-IN) Throughout the App

## Current State

The system is **entirely hardcoded to metric (mm)** with Canadian bar sizes (10M, 15M, 20M...). The "System of Measurement" toggle in Member Area → System Config is **purely cosmetic** — local React state that isn't persisted or consumed anywhere.

The scope of a full unit system implementation is very large. Here's what's involved:

## Affected Areas

1. **Bar size naming**: Metric uses `10M, 15M, 20M...` (Canadian RSIC). Imperial uses `#3, #4, #5, #6, #7, #8, #9, #10, #11, #14, #18` (US ASTM).
2. **Length fields**: `total_length_mm`, `cut_length_mm`, `stock_length_mm` — all stored in mm. Imperial would display as feet-inches (e.g., `4'-2"`).
3. **AI extraction**: The `manage-extract` edge function validates against `VALID_BAR_SIZES = ["10M", "15M", ...]` only.
4. **Machine registry**: Capacity tables keyed by `10M`, `15M`, etc.
5. **Optimization engine**: `cutOptimizer.ts` and `foremanBrain.ts` — all internal math in mm.
6. **Display across 40+ components**: Tags, labels, cut plan details, production queue, slot tracker, pickup station, packing slips, etc.

## Proposed Approach

### Phase 1 — Persist the setting & create conversion utilities

1. **Database**: Add a `unit_system` column (`metric` | `imperial`) to the `companies` table (default `metric`).
2. **Shared utility** (`src/lib/unitSystem.ts`):
   - `useUnitSystem()` hook — reads from company settings
   - `formatLength(mm, system)` → `"1200 mm"` or `"3'-11¼"`
   - `parseLength(input, system)` → mm (always store mm internally)
   - `barSizeLabel(metricCode, system)` → `"20M"` or `"#6"`
   - `BAR_SIZE_MAP`: bidirectional mapping `10M↔#3, 15M↔#4, 20M↔#5, 25M↔#8, 30M↔#9, 35M↔#11, 45M↔#14, 55M↔#18`
3. **Persist the toggle**: Wire MemberAreaView's toggle to actually save to the `companies` table.

### Phase 2 — Display layer conversion

4. **Update display components** to use `formatLength()` and `barSizeLabel()` instead of raw mm values:
   - `TagsExportView.tsx` — tag labels, CSV/ZPL export
   - `DetailedListView.tsx` — cut length column
   - `OptimizationView.tsx` — stock length, kerf, remnants
   - `CutPlanDetails.tsx` — item display
   - `SlotTracker.tsx`, `PickupStation.tsx`, `PackingSlips` — all length displays
   - `BarlistMappingPanel.tsx` — column headers

### Phase 3 — Input & extraction

5. **AI extraction** (`manage-extract`): Accept both metric and imperial bar sizes in validation. Auto-detect from the document format and map to the canonical metric code for storage.
6. **Input fields**: Length inputs accept mm or ft-in based on setting. Convert to mm before storing.
7. **Machine registry**: Display capacity using `barSizeLabel()`.

### Key Principle
**Store everything in mm internally. Convert only at display and input boundaries.**

### Changes Summary

| File | Change |
|------|--------|
| `companies` table | Add `unit_system` column |
| New `src/lib/unitSystem.ts` | Conversion utilities + hook |
| `src/components/office/MemberAreaView.tsx` | Persist toggle to DB |
| `supabase/functions/manage-extract/index.ts` | Accept imperial bar sizes |
| ~15 display components | Use `formatLength()` / `barSizeLabel()` |
| `src/components/office/OptimizationView.tsx` | Unit-aware inputs/displays |
| `src/components/shopfloor/machineRegistry.ts` | Display-only mapping |

This is a large but systematic change. The conversion utility makes it mechanical — each component just wraps its mm values with `formatLength()` and bar codes with `barSizeLabel()`.

