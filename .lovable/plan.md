

# Fix: Add `shop_supervisor` role to ai@rebar.shop in Production

## Problem
Production database only has `workshop` for `ai@rebar.shop`. The `shop_supervisor` role was never added there — it only exists in the test environment. After the `admin` role was removed by the migration, the account lost all supervisor capabilities on the live site.

## Root Cause
Data-modifying SQL (INSERT/DELETE) in migrations is ignored by the deployment diff tool (as noted in project memory). The previous migration to delete `admin` may have partially worked, but the `shop_supervisor` INSERT was never applied to production.

## Fix

### 1. Database migration: Ensure `shop_supervisor` role exists
```sql
INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, 'shop_supervisor'::app_role
FROM public.profiles p
WHERE p.email = 'ai@rebar.shop'
AND NOT EXISTS (
  SELECT 1 FROM public.user_roles ur 
  WHERE ur.user_id = p.user_id AND ur.role = 'shop_supervisor'
);
```

This is idempotent — won't error if it already exists (test env).

### 2. Also ensure `admin` is removed (idempotent)
```sql
DELETE FROM public.user_roles
WHERE user_id = (SELECT user_id FROM public.profiles WHERE email = 'ai@rebar.shop')
AND role = 'admin';
```

### Important caveat
Per project memory, the deployment system may ignore DML statements. If the migration doesn't apply to production on publish, you'll need to run the INSERT SQL manually via Cloud Backend > Run SQL with "Live" selected.

## Expected result after fix
- Production roles for `ai@rebar.shop`: `workshop` + `shop_supervisor`
- All supervisor controls work on shopfloor
- No admin-only UI panels load

