

# Fix: Migration Pipeline + Delivery Creation RLS

## Issue 1: Migration Pipeline Blocked (odoo_id)
The first migration `20260304234951` tries to create `idx_leads_odoo_id_unique` **without deduplicating first**, so it fails on duplicate `odoo_id=3083`. This blocks ALL subsequent migrations from running on production.

**Fix**: Edit `20260304234951` to add the dedup DELETE before the CREATE INDEX. Then convert the three later fix-attempt migrations to no-ops (`SELECT 1;`).

### Files to edit:
- `supabase/migrations/20260304234951_f3b11fd1-92a6-4b57-a45e-2967837649e5.sql` -- add dedup before index
- `supabase/migrations/20260305031029_a8c55015-d526-4cb6-8242-a0a5ef2509d2.sql` -- `SELECT 1;`
- `supabase/migrations/20260305144441_4a7998d1-f7c7-4e06-95b8-6fe60288ccb0.sql` -- `SELECT 1;`
- `supabase/migrations/20260305150909_ea5ec3cd-5e6d-471e-9a54-ff8bc116ce82.sql` -- `SELECT 1;`

## Issue 2: Delivery Creation RLS Error
The `delivery_stops` INSERT policy only allows `admin`, `office`, and `field` roles. The `workshop` role is **excluded**. When a workshop user clicks CREATE DELIVERY, the `deliveries` insert succeeds (workshop is allowed), but the `delivery_stops` insert fails with an RLS violation.

**Fix**: Add a new migration to drop and recreate the `delivery_stops` INSERT policy to include `workshop`.

```sql
DROP POLICY IF EXISTS "Office staff insert delivery_stops" ON delivery_stops;
CREATE POLICY "Staff insert delivery_stops" ON delivery_stops
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = get_user_company_id(auth.uid())
    AND has_any_role(auth.uid(), ARRAY['admin','office','field','workshop']::app_role[])
  );
```

### Summary

| Change | Action |
|---|---|
| Fix first migration (dedup before index) | Edit file |
| No-op 3 subsequent migrations | Edit files |
| Add `workshop` to `delivery_stops` INSERT | New migration |

