

## Plan: Enforce Global Unit Conversion in Bar List Import Pipeline

### Problem

The `applyMapping` edge function maps bar_size, grade, and shape_type but **does NOT apply unit conversion** to `total_length_mm` or dimension columns (dim_a through dim_r). The unit system is saved on the session but never used to convert raw values before validation runs. This means:

- If the source file is in inches/feet, validation checks raw values against mm thresholds (e.g., 18000mm max) — producing false warnings
- The converted values only exist client-side in `BarlistMappingPanel` preview but are never persisted

### Changes

**File: `supabase/functions/manage-extract/index.ts` — `applyMapping` function**

1. Read `unit_system` from the session record (add it to the SELECT)
2. Compute `lengthFactor` from unit_system: mm=1, in=25.4, ft=304.8, imperial=25.4
3. For each row, apply `lengthFactor` to `total_length_mm` and all dimension columns (dim_a through dim_r, skipping dim_i) — write the converted values back to the DB
4. Store the original raw values in a new field `original_length` (or skip if already converted) to prevent double-conversion on re-apply

**File: `supabase/functions/manage-extract/index.ts` — `applyMapping` function (re-apply guard)**

5. Add a guard: if session status is already "mapped" and user re-triggers apply-mapping (after changing unit), reset all rows' length/dims back to originals before re-applying with the new factor. Use a `raw_total_length_mm` column or store originals in a JSON field on first mapping.

**File: `src/components/office/BarlistMappingPanel.tsx`**

6. When user changes unit toggle or mapping dropdown, reset `confirmed` state (already done) — no additional change needed here
7. Pass the selected `lengthUnit` value (not just "imperial"/"metric") to `onConfirmMapping` so the exact unit is persisted on the session

**File: `src/components/office/AIExtractView.tsx` — `handleMappingConfirmed`**

8. Persist the exact unit value (mm/in/ft/imperial) to `extract_sessions.unit_system` instead of coercing to just "imperial"/"metric"

### Database Migration

Add `raw_total_length_mm` and `raw_dims_json` columns to `extract_rows` to store original pre-conversion values:

```sql
ALTER TABLE public.extract_rows 
  ADD COLUMN IF NOT EXISTS raw_total_length_mm numeric,
  ADD COLUMN IF NOT EXISTS raw_dims_json jsonb;
```

### Validation Guarantee

After these changes, the flow becomes:
1. User selects unit + mapping → confirms
2. `handleMappingConfirmed` persists exact unit to session
3. `applyMapping` reads unit from session, stores originals, converts all rows globally
4. `validateExtract` runs on already-converted mm values — consistent across all rows
5. If user changes unit and re-confirms, originals are restored then re-converted

### Files Modified
- `supabase/functions/manage-extract/index.ts` — unit conversion in applyMapping
- `src/components/office/BarlistMappingPanel.tsx` — pass exact unit value
- `src/components/office/AIExtractView.tsx` — persist exact unit
- Database migration: add raw value columns to extract_rows

