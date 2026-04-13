

## Problem

The `formatLengthByMode` function in `src/lib/unitSystem.ts` returns bare numbers for `"in"`, `"ft"`, and `"mm"` display modes — no unit symbols are appended. Only `"imperial"` mode includes symbols (`'` and `"`). This means LENGTH and dimension columns show values like `105`, `8.75` instead of `105"`, `8.75'`.

## Fix

**File:** `src/lib/unitSystem.ts` — `formatLengthByMode` function

Update the three bare-number cases to append their unit symbol:

- `"mm"` → append ` mm` (e.g., `2667 mm`)
- `"in"` → append `"` (e.g., `105"`)
- `"ft"` → append `'` (e.g., `8.75'`)

The `"imperial"` case already renders correctly and needs no change.

### Dimension columns

The same function is used for dimension values (A, B, C, etc.), so the fix automatically applies there too. No additional changes needed.

### No other files affected

The display function is the single formatting point — `AIExtractView`, `BarlistMappingPanel`, and other consumers call `formatLengthByMode` and will pick up the symbols automatically.

