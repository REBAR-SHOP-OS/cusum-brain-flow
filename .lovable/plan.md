

# Fix: `cut_batches_company_id_fkey` Foreign Key Mismatch

## Problem
The `cut_batches.company_id` column has a foreign key referencing `companies.id` (the row UUID), but the code inserts the **tenant ID** (`a0000000-0000-0000-0000-000000000001`) — which lives in `companies.company_id`, not `companies.id`.

Every other table in the system treats `company_id` as the tenant scoping column. The `cut_batches` FK is incorrectly pointing to `companies.id` instead of being a plain tenant column (or referencing nothing, like most other tables).

## Fix
Drop the incorrect foreign key constraint. The `company_id` column on `cut_batches` is a tenant-scoping column, consistent with every other table in the system. No code changes needed — the edge function is already inserting the correct tenant value.

### Migration
```sql
ALTER TABLE public.cut_batches DROP CONSTRAINT cut_batches_company_id_fkey;
```

One migration, no code changes. The `manage-machine` edge function will work immediately after this.

