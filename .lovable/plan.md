

## Fix: Link Vicky's Auth Account to Her Profile

### Problem
Vicky has an auth account (`vicky@rebar.shop`) and she has admin + accounting roles assigned. However, her profile record in the `profiles` table has `user_id = NULL` -- it was never linked to her auth account.

Because of this, the RLS policy "Admins can read all company profiles" calls `get_user_company_id(auth.uid())` which returns NULL (no profile found for her auth user), so the company_id comparison fails and she sees zero profiles.

### Solution
A single database update to link Vicky's auth user ID to her existing profile record.

### Technical Details

**Database migration (1 statement):**
- Update the `profiles` row for "Vicky Anderson" (id: `e82c7ca3-126f-4f88-a368-4774aa8d450e`) to set `user_id = 'c612f0e6-41bd-4775-9ce2-f57aeb20bdb2'`

No code changes needed. Once the profile is linked, the existing RLS policies will work correctly and Vicky will see all company profiles in Team Hub.

