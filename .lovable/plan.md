

## Plan: Fix Imperial Dimension Extraction — Root Cause (3rd attempt)

### What the data confirms

The latest extraction session (`b56f5e1c`, unit_system=`imperial`) still has:
- `dim_a = 6`, `dim_c = 6`, `total_length_mm = 8`
- `source_dims_json = null`
- No ×25.4 conversion applied

This means **two independent bugs**:

### Bug 1: `parseDimension` parses the raw cell number, not the formatted text

Line 151: `it[d] = raw != null ? (parseDimension(raw) ?? null) : null`

The `.xls` file stores imperial dimensions as **custom-formatted numbers** (e.g., the number `6.270833` with format `#'-# #"` displays as `6'-3 ¼"`). `sheet_to_json(header:1)` returns the raw number (`6.270833`), not the text. `parseDimension(6.270833)` returns `6.270833` (it's already a number, line 44). `safeDim` rounds to `6`. Even with ×25.4 = 152mm — this is wrong because the actual value is 75.25 inches (1911mm).

**Fix**: Parse from `cellText` (the formatted display string) instead of `raw` when `cellText` contains imperial markers (`'`, `"`, `-`). `cellText` uses the cell's `.w` property which gives "6'-3 ¼"" — the exact source text. `parseDimension("6'-3 ¼\"")` correctly returns 75.25 inches.

### Bug 2: `source_dims_json` is null despite being set in code

The code sets `it.__source_dims = sourceDims` at line 154 and reads it at line 687. If the deployed function doesn't have this code, or if `overlaySheetDims` fails before reaching line 154, `source_dims_json` stays null.

The edge function must be **redeployed** with the latest code. Additionally, add error logging to confirm overlaySheetDims is executing.

### Changes

#### File: `supabase/functions/extract-manifest/index.ts`

**Fix A: Parse dimensions from formatted cell text, not raw numeric values**

Replace lines 147-151 in `overlaySheetDims`:
```typescript
const raw = row[colMap[d]];
const cellText = getCellText(sheetRow, colMap[d]);
sourceDims[d] = cellText ?? (raw != null ? String(raw).trim() : "");
// CHANGED: parse from formatted text first (preserves ft-in),
// fall back to raw only if text is unavailable
const parseSource = cellText ?? (raw != null ? String(raw) : null);
it[d] = parseSource != null ? (parseDimension(parseSource) ?? null) : null;
```

Same fix for length at lines 157-162:
```typescript
const raw = row[colMap["__LENGTH__"]];
const cellText = getCellText(sheetRow, colMap["__LENGTH__"]);
it.__source_length = cellText ?? (raw != null ? String(raw).trim() : null);
const parseSource = cellText ?? (raw != null ? String(raw) : null);
const parsed = parseSource != null ? parseDimension(parseSource) : null;
if (parsed != null) it.total_length = parsed;
```

This ensures `6'-3 ¼"` is parsed as 75.25 inches (not 6), and `8'-9 ¼"` is parsed as 105.25 inches (not 8).

**Fix B: Redeploy edge function**

Deploy `extract-manifest` to apply all accumulated fixes (×25.4 conversion, source_dims_json capture, and the new cellText parsing).

#### File: `src/components/office/AIExtractView.tsx`

No changes needed — the display logic is already correct:
1. Shows `source_dims_json` text when available (e.g., `6'-3 ¼"`)
2. Falls back to `formatLengthByMode(mmVal)` which converts correct mm to imperial display

### Expected result after fix + re-extraction

| Source | parseDimension result | ×25.4 stored mm | source_dims_json | UI display |
|--------|----------------------|-----------------|-----------------|------------|
| `6"` | 6 | 152 | `"6\""` | `6"` |
| `6'-3 ¼"` | 75.25 | 1911 | `"6'-3 ¼\""` | `6'-3 ¼"` |
| `8'-9 ¼"` | 105.25 | 2673 | `"8'-9 ¼\""` | `8'-9 ¼"` |
| `1'-4"` | 16 | 406 | `"1'-4\""` | `1'-4"` |

### Re-extraction required
After deploying, the current session must be re-extracted to populate correct values.

