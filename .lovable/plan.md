

## Plan: Fix Purchasing Recents Delete — Missing RLS Policy

### Problem
The trash button on RECENTS items calls `deleteConfirmedList` which runs a Supabase `.delete()` on `purchasing_confirmed_lists`. However, the table only has **SELECT** and **INSERT** RLS policies — there is **no DELETE policy**. The delete silently fails because RLS blocks it.

### Fix
Add a DELETE RLS policy to `purchasing_confirmed_lists` via a new database migration:

```sql
CREATE POLICY "pcl_delete"
  ON public.purchasing_confirmed_lists
  FOR DELETE
  TO authenticated
  USING (
    company_id::text IN (
      SELECT p.company_id::text FROM public.profiles p WHERE p.user_id = auth.uid()
    )
  );
```

### Files
- **Database migration only** — no code changes needed. The `deleteConfirmedList` function and UI are already wired correctly; they just need the RLS policy to allow the operation.

