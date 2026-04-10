

# Fix Inch Display Rounding Errors in Extract View

## Problem
When the barlist says `149`, the display shows `149.02` (or similar decimals). This happens because:
1. Raw value 149 (inches) is converted to mm: `149 × 25.4 = 3785.6 → Math.round → 3786`
2. Display converts back: `3786 ÷ 25.4 = 149.055… → "149.06"`

The integer rounding during mm storage introduces decimal artifacts on the round-trip back to inches.

## Solution
When the display unit matches the session's source unit (e.g., both "in"), show the **raw pre-conversion values** instead of round-tripping through mm. The raw values are already stored in `raw_total_length_mm` and `raw_dims_json` columns and already fetched by `fetchExtractRows`.

## Changes

### 1. `src/components/office/AIExtractView.tsx`
In the two table renderings (compact + full), for LENGTH and dim columns:
- When `displayUnit` matches `activeSession.unit_system` and raw values exist on the row, display raw values directly (no conversion)
- Otherwise, keep existing `formatLengthByMode` conversion

Helper logic (inline or small function):
```text
if displayUnit === sessionUnit AND row.raw_total_length_mm exists:
  show raw_total_length_mm (for length)
  show raw_dims_json[col] (for dims)
else:
  formatLengthByMode(row.total_length_mm, displayUnit)
```

This affects ~4 render spots (2 tables × length + dims).

### 2. `src/lib/extractService.ts` (no change needed)
Already fetches `select("*")` which includes raw columns.

## Scope
- 1 file changed: `AIExtractView.tsx`
- Display-only fix — no database changes, no edge function changes
- Existing data preserved; raw columns already populated by `applyMapping`

