
## Fix: External Users Not Visible in Team Members

### Root Cause

When `ryle.lachini@gmail.com` signed up, the `handle_new_user()` database trigger created their profile **without a `company_id`**. The admin's RLS policy for reading profiles requires `company_id = get_user_company_id(admin)`, so profiles with NULL `company_id` are invisible.

### The Fix (2 steps)

**Step 1 -- Fix the existing broken profile (one-time data fix)**

Run a migration to set the correct `company_id` on the orphaned profile:

```sql
UPDATE profiles
SET company_id = 'a0000000-0000-0000-0000-000000000001'
WHERE email = 'ryle.lachini@gmail.com'
  AND company_id IS NULL;
```

**Step 2 -- Fix the trigger so future signups get a company_id automatically**

Update `handle_new_user()` to assign a default company_id. Since this is a single-tenant system (one company), it will use the existing company ID:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email, company_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'a0000000-0000-0000-0000-000000000001'
  );
  RETURN NEW;
END;
$$;
```

### What This Fixes
- The admin will immediately see `ryle.lachini@gmail.com` in the People / Team Members list
- All future user signups will automatically get the correct company assignment
- No code changes needed -- this is purely a database-level fix

### Files Modified
- Database migration only (no frontend file changes)
