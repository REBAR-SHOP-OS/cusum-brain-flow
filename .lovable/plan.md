

## Plan: Fix Unit Conversion Pipeline End-to-End

### Flow Audit (GPS Routing)

```text
EXTRACTION (AI)          MAPPING (Edge Fn)         STORAGE (DB)            DISPLAY (UI)              DOWNSTREAM
─────────────────────    ────────────────────      ──────────────          ────────────────           ──────────────
AI returns values in     applyMapping() saves      total_length_mm         AIExtractView has         OptimizationView:
source unit (e.g. 44.5   raw → raw_total_length    stores raw value        defensive heuristic:      lengthMm = total_length_mm
inches)                  raw_dims_json             (44 not 1118mm)         "if < 50, multiply by     (expects mm!)
                         Then copies raw → main                            25.4" — fragile hack
                         columns AS-IS ❌                                                            TagsExportView:
                                                                                                     getWeight(size, total_length_mm)
                                                                                                     (expects mm!)

                                                                                                     Production/Shop Floor:
                                                                                                     all assume mm
```

### Problems Found

| Location | Issue |
|----------|-------|
| `manage-extract/index.ts` L344 | `total_length_mm` and `dim_*` store raw source-unit values instead of mm |
| `AIExtractView.tsx` L277-279 | Fragile heuristic: `if mmVal < 50 → multiply by 25.4` — breaks for short metric bars |
| `AIExtractView.tsx` L316-318 | Same fragile heuristic for dimensions |
| `OptimizationView.tsx` L48 | Uses `total_length_mm` directly as mm — gets wrong cut plans |
| `TagsExportView.tsx` L115 | `getWeight()` uses `total_length_mm` as mm — calculates wrong weight |

### Fix — 3 Changes

**1. Edge Function: `supabase/functions/manage-extract/index.ts`** (lines 344-354)

Replace the "NO conversion" block with proper unit conversion:

```typescript
// Compute conversion factor
const factor = (effectiveUnit === "in" || effectiveUnit === "imperial") ? 25.4
             : effectiveUnit === "ft" ? 304.8
             : 1; // mm

// Convert to mm for main columns
if (rawLength != null) {
  updates.total_length_mm = Math.round(rawLength * factor);
}

for (const col of DIM_COLUMNS) {
  const rawVal = rawDims[col] ?? row[col];
  if (rawVal != null) {
    updates[col] = Math.round(rawVal * factor);
  }
}
```

Update response (line 460): `length_factor: factor` instead of `1`.

**2. Display Fix: `src/components/office/AIExtractView.tsx`**

Remove the two defensive heuristic blocks that try to guess unconverted values:

- **Lines 275-280**: Remove `if (isImperialSession && mmVal < 50 ...)` block for length — after fix, `total_length_mm` is always mm
- **Lines 315-319**: Remove same heuristic for dimensions

These heuristics would **double-convert** after the edge function fix.

**3. Deploy** the `manage-extract` edge function.

### What stays the same
- `raw_total_length_mm` and `raw_dims_json` — untouched, still store source-unit values
- `source_total_length_text` and `source_dims_json` — untouched, still store formatted text
- Display logic using raw values for lossless cross-unit conversion — works correctly
- `formatLengthByMode`, `formatConvertedLength` — unchanged
- All downstream consumers (optimization, tags, weight, production) — now get correct mm values
- Existing sessions that haven't been re-mapped keep their current data; re-applying mapping will fix them

### Impact
- Optimization cuts will use correct mm lengths
- Weight calculations will be accurate
- Tags/export will show correct values
- No more fragile "guess if it's converted" heuristics

