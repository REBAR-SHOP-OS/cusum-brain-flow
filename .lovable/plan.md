## Goal
Make the Bending Station's Bending Schematic display imperial dimensions as `3'-9"` (the same source string the tag uses) instead of `45"`. Tags already show ft-in correctly — no change there.

## Root cause
- **Tags** read `cut_plan_items.source_dims_json` (raw strings like `3'-9"`).
- **Bending Station** reads `cut_plan_items.bend_dimensions` (numeric inches: `45`) and appends `"`.

Both columns exist on the same row. The station simply isn't reading the source column.

## Changes (frontend only, surgical)

1. **`src/hooks/useStationData.ts`**
   - Add `source_dims: Record<string, string> | null` to `StationItem`.
   - In both `map(...)` blocks (bender + cutter), pass through `source_dims: (item as any).source_dims_json ?? null`.

2. **`src/components/shopfloor/BendingSchematic.tsx`**
   - Accept new optional prop `sourceDims?: Record<string, string> | null`.
   - For each dimension key, if `sourceDims?.[key]` is a non-empty string, render it verbatim (no unit suffix — string already contains `'` / `"`).
   - Otherwise fall back to current behavior: numeric value + `unitLabel`.

3. **`src/components/shopfloor/BenderStationView.tsx`** (both BendingSchematic usages at lines 296 + 343)
   - Pass `sourceDims={currentItem.source_dims}` alongside existing `dimensions` and `unitSystem` props.

## Regression test
Add `tests/regression/shopfloor/bending-schematic-source-dims.test.ts`:
- When `sourceDims = { B: "3'-9\"", C: "5\"" }` and `dimensions = { B: 45, C: 5 }`, rendered output must contain `3'-9"` (not `45"`).
- When `sourceDims` is null, falls back to numeric inches with `"` suffix.

## Out of scope
- No DB changes (column already exists).
- No metric path change (metric items have no `source_dims_json`, fallback path unchanged).
- No tag changes (already correct).
- Cutter station's schematic (line 296) gets the same fix automatically — desired, since same data model.

## Verification
- `vitest run tests/regression/shopfloor/bending-schematic-source-dims.test.ts`
- Reload `/shopfloor/station/...` for mark C1513 → B/C/D should read `3'-9"`, `5"`, `3'-9"` (matching the printed tag).
