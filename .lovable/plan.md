

# Fix: LENGTH column shows inch values when ft-in display mode is selected

## Problem
When the user selects "ft-in" in the display unit toggle, the LENGTH column header says "LENGTH (ft-in)" but the values remain in inches (e.g., 76, 68, 54). The expected display would be ft-in format like `6'-4"`.

## Root Cause
In `AIExtractView.tsx`, the `displayLength` function (line 242) has a priority shortcut: if `source_total_length_text` exists, it returns the raw text from the original file **without any conversion**, regardless of what display unit the user selected.

```typescript
if (row.source_total_length_text != null && row.source_total_length_text !== "") {
  return row.source_total_length_text;  // ← always returns raw, ignores displayUnit
}
```

The same issue exists in `displayDim` (line 255) — `source_dims_json` values are returned raw regardless of the selected display unit.

The source text is the original cell value (in inches). When the user toggles to "ft-in", these values should be converted from stored mm to ft-in format using `formatLengthByMode`, but the source-text shortcut fires first and prevents the conversion.

## Fix — `src/components/office/AIExtractView.tsx`

### 1. Only use source text when displayUnit matches sessionSourceUnit
The `source_total_length_text` shortcut should only apply when the display unit matches the original source unit of the file. When the user switches to a different display unit, the conversion path via `formatLengthByMode` should be used instead.

```typescript
// Before (broken):
if (row.source_total_length_text != null && row.source_total_length_text !== "") {
  return row.source_total_length_text;
}

// After (fixed):
if (displayUnit === sessionSourceUnit && 
    row.source_total_length_text != null && row.source_total_length_text !== "") {
  return row.source_total_length_text;
}
```

### 2. Same fix for displayDim
Apply the same guard to `source_dims_json` in the `displayDim` function — only use raw source text when display unit matches source unit.

### 3. Add unit label to LENGTH column header
Update the LENGTH header (line 2198-2200) to show the active display unit:
```
LENGTH ({lengthUnitLabelByMode(displayUnit)})
```

## Scope
- 1 file modified: `src/components/office/AIExtractView.tsx`
- ~6 lines changed
- No database changes

