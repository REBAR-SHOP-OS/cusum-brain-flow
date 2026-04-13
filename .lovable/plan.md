

## Problem

The extraction pipeline loses the original ft-in formatting from the source spreadsheet. When the XLS file contains `8'-9 ¼"` as a formatted cell, the system stores `"105.25"` (decimal inches) in `source_total_length_text` instead of preserving the original ft-in text.

**Root cause**: SheetJS reads the raw numeric cell value (105.25) instead of the formatted display text ("8'-9 ¼""). The `overlaySheetDims` function in `extract-manifest` captures this raw number, so the lossless source text is lost.

**Display correctness**: After mapping, `total_length_mm` IS properly converted to mm (e.g., 2667mm), and when "ft-in" is selected, `formatLengthByMode` correctly renders it back as `8'-9¼"`. The inches display in the screenshot likely occurred before mapping was applied (pre-mapped status shows raw `String(mmVal)`).

## Plan

### 1. Preserve formatted cell text in `extract-manifest`
**File:** `supabase/functions/extract-manifest/index.ts`

In `overlaySheetDims`, use SheetJS's `w` (formatted text) property of each cell instead of just the `v` (value) property when capturing `__source_length` and `__source_dims`. This preserves the original ft-in text:
```
// Instead of: String(raw)
// Use: cell.w || String(cell.v)
```

Access the cell object directly from the sheet using cell address (e.g., `sheet[XLSX.utils.encode_cell({r, c})]`) to get the `.w` formatted text.

### 2. Apply same fix to dimension columns
Same file, same function — use `.w` for dimension source text capture so `source_dims_json` also preserves ft-in formatting like `6"`, `6'-3 ¼"` instead of raw numbers.

### 3. No display changes needed
The `displayLength` function and `formatLengthByMode` already handle the "imperial" display mode correctly after mapping. The conversion logic (`× 25.4` to mm) is working. No frontend changes required.

### Technical Details
- SheetJS cell objects have `.v` (raw value — often a number) and `.w` (formatted text — what the user sees in Excel)
- For XLS files with custom number formats (ft-in), `.v` returns inches as a decimal, while `.w` returns the display text
- The `__source_length` and `__source_dims` fields feed into `source_total_length_text` and `source_dims_json` in the database
- Only the edge function `extract-manifest/index.ts` needs modification

