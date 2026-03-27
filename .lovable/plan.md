

# Fix Wrong Numbers in Bar List

## Problem Summary

Two bugs causing incorrect dimension values in the extraction pipeline:

### Bug 1: Mapping Preview Shows Inflated Values
The mapping preview panel at the top of the page shows wildly incorrect numbers (e.g. `87'-4"` instead of `3'-5"` for the same bar).

**Root cause**: Double unit conversion. `buildDimensionsJson()` in `BarlistMappingPanel.tsx` multiplies raw dim values by `lengthFactor` (×25.4 for imperial), then `formatLengthByMode()` converts the already-converted mm value again. Result: values inflated by 25.4×.

**Fix**: Remove the `lengthFactor` multiplication from `buildDimensionsJson` and `previewRows` length calculation. The raw values in `extract_rows` are already in their source units. `formatLengthByMode` handles the display conversion — it should receive the raw mm values directly, not pre-converted ones.

### Bug 2: AI Extraction Returns NULL Dimensions for Imperial XLSX
For the "WINDOW WELL FOOTING AND WALLS - DMA" session, ALL dimension columns and total_length are NULL in the database. The AI failed to extract these values, and `overlaySheetDims` also failed to capture them.

**Root cause**: The `overlaySheetDims` function in `extract-manifest/index.ts`:
1. Only matches headers that are exact single uppercase letters (A, B, C...). If the XLSX has headers like "DIM A", "Dim. B", or combined headers, they won't match.
2. Assigns raw cell values (`row[colMap[d]]`) directly without parsing — if cells contain ft-in strings like `0'-8"`, they stay as strings and `safeDim()` later gets `null` because the overlay already set the value as a string on the item.

**Fix** in `overlaySheetDims`:
1. Broaden header matching: strip "DIM", "DIM.", spaces, and periods before matching against the DIMS array.
2. Apply `parseDimension()` to each cell value so ft-in strings get converted to numeric inches.
3. Add logging for what headers were found and what values were extracted.

## Technical Details

### File 1: `src/components/office/BarlistMappingPanel.tsx`

**Lines ~151-157** (`buildDimensionsJson`):
```tsx
// BEFORE: applies factor (causes double conversion)
if (val != null && val !== 0) dims[d] = Math.round(Number(val) * factor);

// AFTER: pass through raw mm values, let formatLengthByMode handle display
if (val != null && val !== 0) dims[d] = Math.round(Number(val));
```

**Lines ~209-221** (`previewRows`):
```tsx
// BEFORE: multiplies length by lengthFactor
length: Math.round(Number((row as any)[mapping.length] ?? 0) * lengthFactor),
dimensions_json: buildDimensionsJson(row, lengthFactor),

// AFTER: raw values, no factor
length: Math.round(Number((row as any)[mapping.length] ?? 0)),
dimensions_json: buildDimensionsJson(row, 1),
```

Same fix at **lines ~226-234** (`handleConfirm` allMapped).

### File 2: `supabase/functions/extract-manifest/index.ts`

**Lines ~60-92** (`overlaySheetDims`):
- Broaden header detection to strip "DIM", "DIM.", spaces, periods before letter matching
- Apply `parseDimension()` to each cell value so ft-in strings become numeric
- Keep existing fallback behavior

```text
Current flow:
  Header "A" → exact match ✓
  Header "DIM A" → no match ✗
  Cell "0'-8\"" → assigned as string → safeDim gets string → may fail

Fixed flow:
  Header "DIM A" → normalize to "A" → match ✓
  Cell "0'-8\"" → parseDimension → 8 (inches) → assigned as number
```

## Files Changed
- `src/components/office/BarlistMappingPanel.tsx` — remove factor from preview data prep (3 locations)
- `supabase/functions/extract-manifest/index.ts` — broaden header matching and parse cell values in overlaySheetDims

