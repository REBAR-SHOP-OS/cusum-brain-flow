

# Fix: Extract Rows Stuck on "Loading" — RLS Nested Policy Issue

## Root Cause

The `extract_rows` and `extract_errors` tables use inline subqueries on `extract_sessions` in their RLS policies. Since `extract_sessions` also has RLS enabled, PostgreSQL applies extract_sessions' own RLS policies to the subquery — creating a nested RLS evaluation. This nested evaluation fails silently, returning 0 rows even though the data exists and the user has the correct company_id.

Console confirms: `[useExtractRows] fetched 0 rows` — the query succeeds but RLS blocks all rows. The `extract_sessions` direct query works fine (sessions load in the UI), but the nested reference from `extract_rows` does not.

Note: `extract_raw_files` uses a direct `company_id` column check (no subquery) and works correctly.

## Fix

Create a `SECURITY DEFINER` function that checks if a session belongs to a user's company, bypassing the nested RLS issue. Then update the policies on `extract_rows` and `extract_errors` to use this function.

### Database Migration

```sql
-- 1. Create SECURITY DEFINER helper to bypass nested RLS
CREATE OR REPLACE FUNCTION public.user_can_access_session(_session_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.extract_sessions
    WHERE id = _session_id
      AND company_id = get_user_company_id(_user_id)
  );
$$;

-- 2. Replace extract_rows SELECT policy
DROP POLICY IF EXISTS "Users can view rows via session company" ON public.extract_rows;
CREATE POLICY "Users can view rows via session company"
  ON public.extract_rows FOR SELECT
  USING (user_can_access_session(session_id, auth.uid()));

-- 3. Replace extract_rows UPDATE policy
DROP POLICY IF EXISTS "Office and admin can update rows" ON public.extract_rows;
CREATE POLICY "Office and admin can update rows"
  ON public.extract_rows FOR UPDATE
  USING (user_can_access_session(session_id, auth.uid())
    AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'office'::app_role]));

-- 4. Replace extract_rows DELETE policy
DROP POLICY IF EXISTS "Admin can delete rows" ON public.extract_rows;
CREATE POLICY "Admin can delete rows"
  ON public.extract_rows FOR DELETE
  USING (user_can_access_session(session_id, auth.uid())
    AND has_role(auth.uid(), 'admin'::app_role));

-- 5. Replace extract_errors SELECT policy
DROP POLICY IF EXISTS "Users can view errors via session company" ON public.extract_errors;
CREATE POLICY "Users can view errors via session company"
  ON public.extract_errors FOR SELECT
  USING (user_can_access_session(session_id, auth.uid()));

-- 6. Replace extract_errors UPDATE policy
DROP POLICY IF EXISTS "Office and admin can update errors" ON public.extract_errors;
CREATE POLICY "Office and admin can update errors"
  ON public.extract_errors FOR UPDATE
  USING (user_can_access_session(session_id, auth.uid())
    AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'office'::app_role]));

-- 7. Replace extract_errors DELETE policy
DROP POLICY IF EXISTS "Admin can delete errors" ON public.extract_errors;
CREATE POLICY "Admin can delete errors"
  ON public.extract_errors FOR DELETE
  USING (user_can_access_session(session_id, auth.uid())
    AND has_role(auth.uid(), 'admin'::app_role));
```

### No Frontend Changes

The client code is correct. The `useExtractRows` hook and `fetchExtractRows` function work as expected — the issue is purely server-side RLS.

### Why This Works

`SECURITY DEFINER` functions execute with the privileges of the function owner (superuser), bypassing RLS on the referenced `extract_sessions` table. This eliminates the nested RLS evaluation that was silently blocking all rows.

