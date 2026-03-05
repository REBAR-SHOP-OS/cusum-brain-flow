

# Fix RLS Policy for Kiosk Profile Registration

## Problem
When `ai@rebar.shop` (workshop role) tries to register a new employee via the Face ID Kiosk, the insert into `profiles` table fails with "new row violates row-level security policy for table 'profiles'".

The `kiosk-register` edge function uses the service role client (`SUPABASE_SERVICE_ROLE_KEY`) which should bypass RLS, but the error persists. The current INSERT policy on `profiles` only allows `admin` role — not `workshop`.

## Fix
Add an INSERT policy on `profiles` for `workshop` and `shop_supervisor` roles, scoped to their own company. This ensures kiosk registration works even if the service role bypass isn't functioning as expected.

```sql
CREATE POLICY "Workshop can insert profiles for their company"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (
  (has_role(auth.uid(), 'workshop'::app_role) OR has_role(auth.uid(), 'shop_supervisor'::app_role))
  AND company_id = get_user_company_id(auth.uid())
);
```

### Files to change
1. **Database migration** — Add the new INSERT policy

No code changes needed.

