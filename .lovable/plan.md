

# Fix: Extract View Must Default to Source Unit and Display Values Correctly

## Problem
Two related issues:
1. **Wrong values shown**: When `unit_system` is changed during mapping (e.g., from "in" to "imperial/ft-in"), the `source_total_length_text` still contains raw inch numbers (76, 68, 54). The display logic returns these raw numbers even when the header says "ft-in", because `displayUnit === sessionSourceUnit` evaluates to true.
2. **Unit persists across sessions**: When starting a new session, the display unit should reset to the new session's source unit, not carry over from the previous session.

## Root Cause
- `source_total_length_text` stores the **original cell text** from the file (e.g., "76" in inches)
- During mapping, the user can change `unit_system` from `"in"` to `"imperial"` (ft-in)
- After this change, `sessionSourceUnit` = `"imperial"`, but the raw text is still in inches
- The guard `displayUnit === sessionSourceUnit` passes, returning raw inch text "76" instead of converting to ft-in format like `6'-4"`
- The raw source text shortcut should only fire when `displayUnit` matches the **original detected unit**, not the user-overridden unit

## Changes

### 1. Track the original detected unit separately (`AIExtractView.tsx`)
Store the **original detected unit** from the extraction (before any user override during mapping) so the source-text shortcut can compare against it correctly.

- Add a new field or derive the original unit: when `source_total_length_text` exists, the raw text is in the **originally detected** unit. Since we don't store this separately, the safest approach is to **never use source text shortcut when displayUnit is "imperial" (ft-in)** — because raw source text is never in ft-in format (it's always plain numbers in mm or inches).

```typescript
const displayLength = (row: any): string => {
  // Raw source text is a plain number from the original file.
  // Only use it when displayUnit is "mm" or "in" (plain number formats).
  // Never use it for "imperial" (ft-in) or "ft" — those need conversion.
  if ((displayUnit === "mm" || displayUnit === "in") && 
      displayUnit === sessionSourceUnit && 
      row.source_total_length_text != null && row.source_total_length_text !== "") {
    return row.source_total_length_text;
  }
  // ... rest of conversion logic
};
```

Same fix for `displayDim`.

### 2. Update LENGTH column header to show active unit
Add the active display unit label to the LENGTH header:
```
LENGTH ({lengthUnitLabelByMode(displayUnit)})
```

### 3. Ensure displayUnit resets on session switch
The existing code already handles this (lines 280-295 and 756-758), but verify the `userSetUnitRef` reset on `activeSessionId` change works correctly. The `startNew` function (line 794-795) already resets to "mm". No change needed here — already working.

## Scope
- 1 file: `src/components/office/AIExtractView.tsx`
- ~10 lines changed in `displayLength` and `displayDim` functions + header
- No database or edge function changes

