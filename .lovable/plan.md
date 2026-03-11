

## Fix: Restore `admin` role for `ai@rebar.shop`

### Problem
The previous migration to restore the admin role failed due to database connection pool exhaustion. Now that you've upgraded the instance, the pool is clear but the migration needs to be re-applied.

Both Test and Live environments are missing the `admin` role for `ai@rebar.shop`, which is why the `system-backup` edge function returns 403.

### Plan
Run a single database migration:

```sql
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'admin'::app_role
FROM public.profiles p
WHERE p.email = 'ai@rebar.shop'
ON CONFLICT (user_id, role) DO NOTHING;
```

This will:
1. Add the `admin` role back to `ai@rebar.shop` in Test immediately
2. Apply to Live when you publish
3. Resolve the 403 error from `system-backup`

No code changes needed — just the migration.

