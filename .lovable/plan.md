

# Fix: Production Migration Pipeline Blocked → delivery_stops Policy Not Applied

## Problem
The `delivery_stops` INSERT policy fix (adding `workshop` role) was applied to **Test** but **never reached Production**. Production is stuck at migration `20260304215226` because the next migration (`20260304234951`) fails -- it tries to create a unique index on `odoo_id` without deduplicating first, and production still has duplicates.

This means all subsequent migrations (including `20260305154125` which fixes the delivery_stops policy) are blocked from running on Production.

## Production State
- **Last applied migration**: `20260304215226` (290 total)
- **delivery_stops INSERT policy**: Still only allows `admin`, `office`, `field` -- **missing `workshop`**
- **Duplicate odoo_ids still exist**: 5027, 2788, 4967, etc.

## Fix

### 1. Edit `20260304234951` to add dedup before index
Currently just `CREATE UNIQUE INDEX...` -- needs `DELETE` dedup step first so it won't fail on production duplicates.

### 2. Convert redundant migrations to no-ops
`20260305031029`, `20260305144441`, `20260305150909` all duplicate the same dedup logic. Convert to `SELECT 1;`.

### 3. No other changes needed
Migration `20260305154125` already contains the correct `delivery_stops` INSERT policy fix with `workshop` role. Once the pipeline unblocks, it will apply automatically on next publish.

| File | Change |
|---|---|
| `supabase/migrations/20260304234951_*.sql` | Add dedup DELETE before CREATE UNIQUE INDEX |
| `supabase/migrations/20260305031029_*.sql` | `SELECT 1;` |
| `supabase/migrations/20260305144441_*.sql` | `SELECT 1;` |
| `supabase/migrations/20260305150909_*.sql` | `SELECT 1;` |

After these edits, publishing will unblock the pipeline and apply the `workshop` role fix to production.

