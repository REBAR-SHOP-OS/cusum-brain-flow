

## Plan: Fix Imperial Dimension Extraction (Root Cause: Header Detection Bug)

### Problem
Dimensions display as `159'-3"`, `119'-7"` instead of `6'-3 ¼"`, `4'-8 ½"` — a double ×25.4 conversion.

### Root cause chain (confirmed from logs + DB)

1. **`normalizeDimHeader` false-matches non-header cells** — The function strips ALL non-letter characters before checking if a single DIMS letter remains. So a cell with `"R1"` (Dwg No value) becomes `"R"` → matches. This causes `overlaySheetDims` to pick the wrong row as the "header row", find only 1 dim column, and **skip** entirely.

2. **`overlaySheetDims` skips → `source_dims_json` = null** — Without the overlay, the exact cell text (`6'-3 ¼"`) is never captured.

3. **AI returns values already converted to mm** — The AI model receives the CSV, sees ft-in text, and returns numeric values in mm (e.g., `1911` for `6'-3 ¼"`). 

4. **Double conversion** — Code detects imperial from cell patterns → `finalToMm = 25.4` → `1911 × 25.4 = 48539` stored as `dim_c`. The displayed `159'-3"` is a correct back-conversion of `48539mm`, but the stored value was wrong.

### Changes

#### File: `supabase/functions/extract-manifest/index.ts`

**Fix 1: Tighten `normalizeDimHeader` (line 84-94)**
After stripping "DIM" prefix and parenthesized suffixes, the remaining text must be exactly one letter (no trailing digits/content). Currently it strips ALL non-letters then checks length — this makes `"R1"` match as `"R"`. Fix: check that the cleaned string (before stripping non-alpha) is a single character or matches pattern `^[A-Z]$`.

```typescript
function normalizeDimHeader(raw: string): string | null {
  let s = String(raw).trim().toUpperCase();
  s = s.replace(/\s*\(.*?\)\s*/g, " ").trim();
  s = s.replace(/^DIM\.?\s*/i, "").trim();
  // Must be exactly a single letter after cleanup — don't strip digits
  if (s.length === 1 && /^[A-Z]$/.test(s) && (DIMS as readonly string[]).includes(s)) return s;
  return null;
}
```

**Fix 2: Add double-conversion guard (after line 668)**
After `overlaySheetDims`, if imperial is detected and overlay succeeded, values are in inches (correct). But if overlay failed and AI returned values, check if the median dim value is large enough to already be mm (>200). If so, set `finalToMm = 1` to prevent double conversion.

```typescript
// After finalToMm computation:
if (finalIsImperial && !overlaySucceeded) {
  const sampleDims: number[] = [];
  for (const it of items.slice(0, 10)) {
    for (const k of DIMS) {
      const v = safeDim(it[k]);
      if (v != null && v > 0) sampleDims.push(v);
    }
  }
  if (sampleDims.length > 2) {
    const median = sampleDims.sort((a, b) => a - b)[Math.floor(sampleDims.length / 2)];
    if (median > 200) {
      console.warn(`[extract-manifest] AI likely returned mm values (median dim=${median}). Skipping ×25.4.`);
      finalToMm = 1;
    }
  }
}
```

**Fix 3: Track overlay success flag**
Return a boolean from `overlaySheetDims` indicating whether the overlay actually applied (found ≥2 columns), so the guard above can use it.

**Fix 4: Redeploy** the edge function.

### Expected result after fix + re-extraction

| Source | Stored mm | source_dims_json | UI (ft-in) |
|--------|----------|-----------------|------------|
| `6'-3 ¼"` | 1911 | `{"C":"6'-3 ¼\""}` | `6'-3 ¼"` |
| `4'-8 ½"` | 1435 | `{"C":"4'-8 ½\""}` | `4'-8 ½"` |
| `6"` | 152 | `{"A":"6\""}` | `6"` |
| `1'-6"` | 457 | `{"G":"1'-6\""}` | `1'-6"` |

### Re-extraction required
After deploying, the file must be re-extracted.

