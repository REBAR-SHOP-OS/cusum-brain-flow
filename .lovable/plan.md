

# Fix: "Unknown Customer" in Production Queue

## Root Cause

Two customer records have `company_id = NULL`:
- `49167c2f...` — "NORTHFLEET GROUP"
- `c56f5215...` — "Northfleet Group"

The RLS policy on the `customers` table requires `company_id = get_user_company_id(auth.uid())`. Since these two records have no company_id, they are invisible to the app, causing the "Unknown Customer (49167c2f)" fallback text.

Both are also duplicates of existing "NORTHFLEET GROUP" / "Northfleet Group" customers that DO have the correct company_id.

## Fix

### 1. Data Fix (SQL migration)

Update the two orphaned customers to set their `company_id` to `a0000000-0000-0000-0000-000000000001` (the company their projects belong to):

```text
UPDATE customers
SET company_id = 'a0000000-0000-0000-0000-000000000001'
WHERE id IN (
  '49167c2f-bb73-40b2-ba08-f72bc2cffed0',
  'c56f5215-4ca1-418c-a408-20a17c89c850'
)
AND company_id IS NULL;
```

### 2. Preventive Fix (SQL migration)

Add a NOT NULL constraint on `customers.company_id` to prevent this from happening again. Also add a validation trigger (or default) so that any future INSERT must include a `company_id`.

```text
ALTER TABLE customers
ALTER COLUMN company_id SET NOT NULL;
```

This is a two-step migration: first backfill the NULLs, then add the constraint.

### 3. Optional: Deduplicate Northfleet

There are 7 customer records matching "Northfleet". You may want to consolidate them later, but that is a separate cleanup task and not required for this fix.

No frontend code changes needed — once the data has the correct `company_id`, the existing code will resolve the names properly.

