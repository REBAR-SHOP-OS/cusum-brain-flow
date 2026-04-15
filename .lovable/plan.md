

## Plan: Fix Imperial Dimension Precision and Source Text Storage

### Root cause (confirmed from DB data)

The latest extraction (`ffc1d980`, "ET10533 WEST PARK HOSPITAL") shows:
- `dim_c = 1905` (should be 1911 for `6'-3 ¼"`)
- `source_dims_json = null` (should contain exact source text)
- `source_total_length_text = "105.25"` (should be `"8'-9 ¼"`)

Three bugs:

**Bug 1: `Math.round` in `parseDimension` loses fractions**
Line 54: `Math.round(parseFloat(ftIn[1]) * 12 + parseFloat(ftIn[2]))` → `6'-3 ¼"` becomes 75 instead of 75.25. Same on lines 60 and 74. This loses ¼" precision (6.35mm per ¼").

**Bug 2: `.w` property not populated on XLSX cells**
`XLSX.read(fileBytes, { type: "array" })` on line 343 does not guarantee `.w` (formatted text) is generated. Need `cellText: true` option to force `.w` population for custom-formatted cells (RebarCAD's ft-in number formats).

**Bug 3: Deployment gap**
The `__source_dims` and `__source_length` assignments exist in code but aren't reaching the DB. Forced redeployment needed.

### Changes

#### `supabase/functions/extract-manifest/index.ts`

1. **Line 343** — Add `cellText: true` to XLSX.read:
```typescript
parsedWorkbook = XLSX.read(fileBytes, { type: "array", cellText: true });
```

2. **Lines 54, 60, 74** — Remove `Math.round` from `parseDimension` to preserve fractional inches:
```typescript
// Line 54: return parseFloat(ftIn[1]) * 12 + parseFloat(ftIn[2]);
// Line 60: return parseFloat(ftOnly[1]) * 12;
// Line 74: return parseFloat(ftInFallback[1]) * 12 + parseFloat(ftInFallback[2]);
```

3. **Redeploy** the edge function to ensure all accumulated fixes are live.

### Expected result after fix + re-extraction

| Source text | parseDimension | ×25.4 stored mm | source_dims_json | UI (imperial) |
|------------|---------------|-----------------|-----------------|---------------|
| `6'-3 ¼"` | 75.25 | 1911 | `"6'-3 ¼"` | `6'-3 ¼"` |
| `8'-9 ¼"` | 105.25 | 2673 | `"8'-9 ¼"` | `8'-9 ¼"` |
| `4'-8 ½"` | 56.5 | 1435 | `"4'-8 ½"` | `4'-8 ½"` |
| `6"` | 6 | 152 | `"6"` | `6"` |
| `1'-4"` | 16 | 406 | `"1'-4"` | `1'-4"` |

### Re-extraction required
After deploying, the file must be re-extracted to populate correct values.

