

## Plan: Fix Imperial Fraction Parsing in AI Extraction

### Root Cause (Confirmed via Database)

The database stores these values for the file `BARLIST R1(R0) COOLONG TOWER FDN.xls`:

| Mark | Original Length | Stored `total_length_mm` | Original dim_c | Stored `dim_c` |
|------|----------------|-------------------------|-----------------|----------------|
| 10A01 | 8'-9 ¼" | **8** | 6'-3 ¼" | **6** |
| 10A02 | 7'-2 ½" | **7** | 4'-8 ½" | **4** |
| 25A01 | 5'-11" | **5** | — | — |

Additionally, `source_dims_json` and `raw_dims_json` are both **NULL** — so the display cannot fall back to source text.

**The bug is in `parseDimension()` (line 24–55 of `extract-manifest/index.ts`)**:

1. RebarCAD XLS stores ft-in values with Unicode fraction characters: `8'-9 ¼"`, `6'-3 ¼"`, `7'-2 ½"`
2. The ft-in regex `^(\d+)\s*[']\s*-?\s*(\d+)\s*[""]?$` **cannot match** because `9 ¼` is not captured by `\d+(\.\d+)?`
3. Falls through to the plain-number fallback: `parseFloat(s.replace(/[^0-9.\-]/g, ""))` which for `"8'-9 ¼"` strips to `"8-9.25"` → `parseFloat("8-9.25")` = **8** (stops at the dash)

This means **every imperial dimension with fractions is truncated to just the feet number**.

### Fix — Two Changes in One File

**File: `supabase/functions/extract-manifest/index.ts`**

**Change 1: Enhance `parseDimension` to handle fraction characters**

Add a pre-processing step that converts Unicode fractions (¼→.25, ½→.5, ¾→.75, ⅛→.125, ⅜→.375, ⅝→.625, ⅞→.875) into decimal form before regex matching. This makes `8'-9 ¼"` become `8'-9.25"` which the existing ft-in regex can handle.

**Change 2: Fix the fallback `parseFloat` stripping**

The plain-number fallback `parseFloat(s.replace(/[^0-9.\-]/g, ""))` incorrectly strips the `'` separator, producing `"8-9.25"` which `parseFloat` truncates at the dash. After fraction normalization, the ft-in regex should catch these cases, but as a safety net, the fallback should also be improved.

### What This Fixes
- All imperial dimensions with fractions (¼, ½, ¾, etc.) will be correctly converted to total inches
- `8'-9 ¼"` → 105.25 inches (stored as 105 after rounding)
- `6'-3 ¼"` → 75.25 inches (stored as 75)
- `1'-6"` → 18 inches (already works, no fractions)
- Source text (`source_dims_json`) capture in `overlaySheetDims` is unaffected — it correctly reads `.w` formatted text. The NULL issue is likely because the AI path ran first and `overlaySheetDims` then overwrote `it[d]` but the `__source_dims` property was correctly set and should flow to the DB.

### Impact
- Only affects the `parseDimension` function in the edge function
- No frontend changes needed — once values are stored correctly, the existing ft-in display logic works
- Existing extractions with correct mm values are unaffected (numbers pass through unchanged)
- **Existing broken extractions will need re-extraction** to get correct values

### Re-extraction Note
After deploying, the user should re-extract the affected file to get correct values. Alternatively, a one-time SQL fix could be applied to known affected rows, but re-extraction is cleaner.

