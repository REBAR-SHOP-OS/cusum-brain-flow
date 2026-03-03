

# Fix: "new row violates row-level security policy for table deliveries"

## Root Cause

The RLS INSERT policy on the `deliveries` table only allows users with `admin`, `office`, or `field` roles. Workshop users operating the Loading Station have the `workshop` role, which is excluded from the policy — so the insert is rejected.

## Fix

Update the existing INSERT policy to include the `workshop` role, since workshop staff need to create deliveries from the Loading Station when loading is complete.

```sql
DROP POLICY "Office staff insert deliveries" ON public.deliveries;
CREATE POLICY "Staff insert deliveries" ON public.deliveries
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = get_user_company_id(auth.uid())
    AND has_any_role(auth.uid(), ARRAY['admin','office','field','workshop']::app_role[])
  );
```

Single migration, no code changes needed.

