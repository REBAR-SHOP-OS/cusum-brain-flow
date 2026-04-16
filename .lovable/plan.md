

## Plan: Remove All Unit Conversion — Store Original Values Throughout Pipeline

### Problem
The pipeline converts values to mm in **two places**:
1. **extract-manifest** (line 674): `finalToMm = 25.4` multiplies all lengths/dims during extraction
2. **manage-extract → applyMapping** (lines 354-382): `getLengthFactor()` multiplies again during mapping

The user wants **zero conversion anywhere**. Extract the original values in their original units (ft, in, mm, ft-in) and keep them as-is through extract → map → validate → approve.

### Changes

**File 1: `supabase/functions/extract-manifest/index.ts`**
- Line 674: Set `finalToMm = 1` unconditionally (never multiply by 25.4)
- Remove the entire heuristic block (lines 680-697) that tries to detect double-conversion — no longer needed since we never convert
- `finalDimToMm` and `finalLengthToMm` become simple pass-through (store raw values as-is)
- The column is still named `total_length_mm` in the DB but will hold the original unit value

**File 2: `supabase/functions/manage-extract/index.ts`**
- Remove `getLengthFactor()` function (lines 280-287) entirely
- In `applyMapping()` (lines 354-382): Remove all unit conversion logic. The mapping step should only handle bar_size mapping, grade mapping, and shape mapping — no length/dim multiplication at all
- Keep `raw_total_length_mm` / `raw_dims_json` storage for re-apply idempotency, but set them equal to the current values (no factor applied)
- In `validateExtract()` (lines 577-594): Remove or adjust the `> 18000` mm-specific warning threshold since values may be in inches or feet. Either remove the sanity check entirely or make it unit-aware using the session's `unit_system`

**File 3: Deploy both edge functions**

### What stays the same
- `source_total_length_text` and `source_dims_json` continue storing display text
- `unit_system` on the session still records what unit the data is in (for UI display)
- Bar size mapping, grade mapping, shape mapping — unchanged
- Approval flow — unchanged

### Result
Raw extracted values flow untouched from extraction through mapping, validation, and approval. The `unit_system` field tells the UI what unit the numbers represent for display purposes only.

