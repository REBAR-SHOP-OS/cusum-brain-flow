# Fix: Trust Source Text for Cut Length Display

## Problem
`cut_length_mm` stores the raw numeric value in the source unit (e.g. `8'` → `96`, not `2438mm`). The current formatter treats it as millimeters and converts, producing wrong values like `3¾"` instead of `8'`.

## Fix
Rewrite `src/lib/cutLengthDisplay.ts` to **trust `source_total_length_text` first** and only fall back to numeric conversion when source text is missing.

### New logic in `formatCutLength`
1. If `source_total_length_text` is present and non-empty → return it verbatim, derive `unitLabel` from its characters (`'` and `"` → `FT-IN`; `'` only → `FT`; `"` only → `IN`; else `MM`).
2. Otherwise fall back to numeric `cut_length_mm` interpreted by `unit_system`:
   - `in` → multiply by 25.4, format as imperial → `FT-IN`
   - `ft` → multiply by 304.8, format as imperial → `FT-IN`
   - default → raw value as `MM`

### Unchanged
- `CutterStationView.tsx`, `ProductionCard.tsx`, `RebarTagCard.tsx` keep calling `formatCutLength` — no edits needed.

## Out of Scope
Renaming the misleading `cut_length_mm` column is deferred to a separate cleanup pass (touches DB schema, types, and many call sites).

## Expected Result
Cutter station, production cards, and printed tags all show `8'` (matching the original barlist) instead of `3¾"`.
