

## Plan: Preserve Original Unit Symbols in Extracted Values

### Problem
Currently, `source_total_length_text` and `source_dims_json` store plain numbers (e.g., `"44"`, `"8"`) without unit symbols. The user wants `5"` for inches, `5'` for feet, `5'-3"` for ft-in, and plain `2790` for mm — preserved from extraction through display.

### Root Cause
1. **For AI-extracted (non-spreadsheet) data**: Line 697 builds `sourceLengthText` from `item.total_length` AFTER `parseDimension()` (line 544-545) has already stripped unit markers like `"`, `'` from the string
2. **For spreadsheet data**: `__source_length` and `__source_dims` correctly preserve the original cell text with symbols — this path already works

### Changes

**File 1: `supabase/functions/extract-manifest/index.ts`**

Before the `parseDimension` pass (line 542), capture the original AI strings with their unit symbols:
- Add a loop that saves each item's raw `total_length` and dimension strings into `__source_length` / `__source_dims` BEFORE `parseDimension` strips them
- Only set these if they aren't already set (spreadsheet overlay already populates them)
- This ensures `source_total_length_text` and `source_dims_json` contain `"44"" `, `"8'"`, `"5'-3""`, or `"2790"` as appropriate

**File 2: `src/components/office/AIExtractView.tsx`**

Update `displayLength()` and `displayDim()` to append unit symbols when `source_total_length_text` / `source_dims_json` lack them (legacy data):
- If `source_total_length_text` already has a symbol (`"`, `'`), show as-is
- If it's a plain number AND `unit_system` is `"in"`, append `"`
- If `unit_system` is `"ft"`, append `'`
- If `unit_system` is `"imperial"` or `"ft-in"`, format as ft-in string
- If `unit_system` is `"mm"` or `"metric"`, show plain number (no symbol)

**File 3: `src/lib/unitSystem.ts`**

Add a small helper `appendUnitSymbol(value: string | number, unitSystem: string): string` that appends the correct symbol based on unit system — reusable across display components.

### What stays the same
- Numeric columns (`total_length_mm`, `dim_a`..`dim_r`) remain plain numbers for calculations
- `source_total_length_text` and `source_dims_json` are display-only text fields — no calculation impact
- Mapping, validation, approval — unchanged

### Result
Values display with their original symbols: `44"`, `8'`, `5'-3"`, `2790` throughout the extraction UI.

