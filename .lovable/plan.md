

## Plan: Fix Imperial Unit Extraction and Display — Root Cause

### Problem
When an imperial (ft-in) barlist is uploaded, the extracted data is fundamentally broken:
- `source_dims_json` is **null** — the `overlaySheetDims` function fails silently
- `dim_a`, `dim_b`, etc. store **raw inch values** (e.g., `6` for `6"`) instead of mm
- `total_length_mm` stores **raw inches** (e.g., `8` for `8'-9¼"`) instead of mm
- Result: the UI shows `6` instead of `6"`, and `8` instead of `8'-9 ¼"`

### Root Causes

**1. `parseDimension()` returns inches, not mm** (extract-manifest/index.ts line 42-78)
- `6"` → returns `6` (inches)
- `1'-4"` → returns `16` (inches)
- These are stored directly into `dim_a`, `dim_b`, etc. and `total_length_mm` — all meant to be mm
- Fix: When `detectedUnitSystem === "imperial"`, multiply parsed dimension values by 25.4 to convert inches→mm before storing

**2. `overlaySheetDims()` fails silently** → `source_dims_json` stays null
- Need to add logging and investigate why it's failing for this file format
- Even if it succeeds, the display path still needs the mm values to be correct for cross-unit conversion

**3. `displayDim()` fallback shows raw numbers** (AIExtractView.tsx line 289-323)
- When `source_dims_json` is null, it falls back to `formatLengthByMode(mmVal, "imperial")` 
- But `mmVal` is actually inches (6) not mm (152.4), so the formatting is wrong
- Fix is upstream in the extraction, but display should also handle the case where source_dims_json exists

### Changes

#### File 1: `supabase/functions/extract-manifest/index.ts`

**Fix A: Convert parsed imperial dimensions from inches to mm before storing**

In the row-building section (lines 587-626), when `detectedUnitSystem === "imperial"`:
- Wrap `safeDim()` calls with `× 25.4` conversion for all dim columns
- Wrap `total_length_mm` with `× 25.4` conversion
- This ensures all stored values are truly in mm regardless of source unit

**Fix B: Debug and harden `overlaySheetDims()`**

- Add more verbose logging to trace why the function returns without processing
- Ensure `getCellText()` captures the original ft-in text (e.g., `6'-3 ¼"`) into `source_dims_json`
- If `overlaySheetDims` runs successfully, `source_dims_json` will contain the exact cell text for lossless display

#### File 2: `src/components/office/AIExtractView.tsx`

**No changes needed** — the `displayDim()` function already correctly:
1. Shows `source_dims_json` text when available (priority 1)
2. Falls back to `formatLengthByMode(mmVal, mode)` which will now receive correct mm values

### What Stays the Same
- `parseDimension()` signature — still returns a number
- `displayDim()` / `displayLength()` logic — already correct once data is right
- `source_dims_json` schema — still stores `{ A: "6\"", B: "1'-6\"", ... }`
- All metric extractions — unaffected since mm values pass through unchanged

### Deployment
- Redeploy `extract-manifest` edge function
- Existing sessions with bad data will need re-extraction to fix stored values

### Result
After fix:
- `dim_a` for `6"` source → stored as `152` (mm), displayed as `6"` (from source_dims_json or formatted)
- `total_length_mm` for `8'-9 ¼"` → stored as `2667` (mm), displayed as `8'-9 ¼"`
- Column headers correctly show "(ft-in)" unit labels
- All dimension values match the source Excel exactly

