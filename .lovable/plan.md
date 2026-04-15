

## Plan: Fix Imperial Dimension Display in UI

### Problem
The UI shows raw numbers (`8`, `6`, `1`) instead of formatted imperial values (`8'-9 ¼"`, `6"`, `1'-4"`) because:

1. **Line 305 / 274 short-circuit**: `displayDim()` and `displayLength()` return `String(mmVal)` for sessions not yet at "mapped" status — bypassing all formatting logic
2. **`source_dims_json` may be null**: Even when `overlaySheetDims` should work, if it fails silently, the source text path is skipped
3. **Old data stores inches as mm**: Data extracted before the conversion fix has raw inch values (6, 8) in `dim_a`, `total_length_mm` instead of mm (152, 203)

### Root Cause
The `displayDim` and `displayLength` functions have a guard at lines 305/274 that says: "if session status is not mapped/validated/approved, just return the raw number." This was meant to show unprocessed data as-is, but it breaks imperial display because raw numbers mean nothing without unit formatting.

### Changes

#### File 1: `src/components/office/AIExtractView.tsx`

**Fix A: Remove the status-based raw-number guard for imperial display**

Replace lines 304-305 in `displayDim()`:
```typescript
if (mmVal == null) return "";
// REMOVED: no longer short-circuit to String(mmVal) for non-mapped sessions
```

Replace lines 273-274 in `displayLength()`:
```typescript
if (mmVal == null) return "—";
// REMOVED: no longer short-circuit to String(mmVal) for non-mapped sessions
```

Both functions should ALWAYS go through the formatting pipeline regardless of session status, so imperial values get proper ft-in formatting.

**Fix B: Ensure `formatLengthByMode` is always the final fallback**

The existing fallback at line 322 (`formatLengthByMode(mmVal, du)`) already handles this correctly — it converts mm to `6"`, `8'-9 ¼"`, etc. We just need to remove the guard that prevents it from being reached.

#### File 2: `supabase/functions/extract-manifest/index.ts`

**Fix C: Add logging to `overlaySheetDims` to debug why `source_dims_json` is null**

Add console.log before and after the function processes each row to confirm it's running correctly for this file format. This ensures future extractions always populate `source_dims_json`.

### Re-extraction Required
The user's current data was extracted before the mm conversion fix. After deploying these changes, re-extracting the file will:
- Store correct mm values (6" → 152mm)
- Populate `source_dims_json` with `{"A": "6\"", "C": "6'-3 ¼\"", ...}`
- Display exactly like the source Excel

### Result
- Dimensions show `6"`, `6'-3 ¼"`, `4'-8 ½"`, `1'-6"` — matching the source Excel exactly
- Length shows `8'-9 ¼"`, `7'-2 ½"`, `5'-11"` — matching the source Excel exactly
- Works for all session statuses (raw, mapped, validated, approved)
- No changes to metric display — unaffected

