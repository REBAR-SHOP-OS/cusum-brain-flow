
# Fix "Unknown" Customer Names in Vizzy Suggestions

## Root Cause

The `generate-suggestions` edge function has a `resolveCustomerName` helper with a broken fallback. When the `customer_id` lookup fails (or isn't matched), it falls back to reading `invData?.CustomerRef?.name` -- but the actual QuickBooks data stored in `accounting_mirror` uses `CustomerName` at the top level, not `CustomerRef.name`.

The customer IS in the `customers` table and the map IS loaded, so the primary lookup path (`customerNameMap`) should work. However, 34 suggestions already have "Unknown" baked into their titles from previous runs.

## Fix (2 changes)

### 1. Fix the fallback in `generate-suggestions` edge function

In `supabase/functions/generate-suggestions/index.ts` (line 121), update the `resolveCustomerName` function to check all possible JSON paths:

```
// Before (broken):
return invData?.CustomerRef?.name ?? "Unknown";

// After (fixed):
return invData?.CustomerName ?? invData?.CustomerRef?.name ?? "Unknown";
```

This ensures the function checks `CustomerName` (the actual field in the data) before falling back to `CustomerRef.name` and finally "Unknown".

### 2. Patch existing "Unknown" suggestions in the database

Run a SQL migration that updates existing suggestion titles by looking up the actual customer name from `accounting_mirror.data`:

- Join `suggestions` to `accounting_mirror` on `entity_id`
- Extract `CustomerName` from the JSONB `data` column
- Replace "Unknown" in the title with the actual customer name
- Only affect suggestions with status `open` or `new` and entity_type `invoice`

This fixes the 34 existing suggestions so users see real customer names immediately without waiting for the next suggestion generation cycle.

## Technical Details

| Item | Detail |
|------|--------|
| Edge function file | `supabase/functions/generate-suggestions/index.ts`, line 121 |
| SQL scope | `suggestions` table, 34 rows with `title LIKE 'Unknown %'` |
| Risk | Low -- single line code fix + targeted data patch |
