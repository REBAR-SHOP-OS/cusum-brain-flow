

# Audit: GRADE BEAM - KCA Extraction Failures

## Root Cause

Four failed sessions, two distinct errors:

### Error 1: `invalid input syntax for type integer: "1727.2"` (3 sessions)
- `total_length_mm` column is **integer** in database
- `parseDimension()` returns **float** values like `1727.2`
- Postgres rejects non-integer values for integer columns

### Error 2: `invalid input syntax for type numeric: "0'-4""` (1 session)
- The `quantity` field received an imperial string like `"0'-4""`
- `parseDimension(item.quantity)` parses it to a number, but the AI likely put a dimension value into the quantity field
- The raw string may have been passed directly without parsing in some code path

## Fix

### File: `supabase/functions/extract-manifest/index.ts`

1. **Round integer columns** — wrap `total_length_mm` and `quantity` with `Math.round()` after `parseDimension()`:
   - `total_length_mm: Math.round(parseDimension(item.total_length) || 0)`
   - `quantity: Math.round(parseDimension(item.quantity)) || 0`

2. **Safety-round all dimension columns** — while `dim_a` through `dim_r` are `numeric` (accepts decimals), apply `Math.round()` to `total_length_mm` and `quantity` since they are integer columns.

3. **Add null/NaN guard** — ensure if `parseDimension` returns something unexpected, it defaults to `null` or `0` for required fields.

### Changes summary
- **1 file**: `supabase/functions/extract-manifest/index.ts` — round integer fields before insert
- **Redeploy** the edge function

### Result
All four "GRADE BEAM - KCA" sessions failed due to type mismatches. After fix, re-extraction should succeed.

