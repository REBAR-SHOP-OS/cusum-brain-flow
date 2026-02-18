

# Fix: Create Missing Database Functions for ARIA

## Problem

The `execute_readonly_query` and `execute_write_fix` database functions **do not exist**. The migration file was created previously but was never applied to the database. This is the root cause of ARIA's inability to fix anything — every `db_read_query` and `db_write_fix` tool call fails because the underlying RPC functions are missing.

The edge function code is correct. The multi-turn loop is correct. The handlers are correct. The problem is purely that these two SQL functions need to be created in the database.

## Solution (1 migration — no code changes)

Apply the exact same migration that was previously approved but never executed:

### SQL Migration

```sql
-- Create execute_readonly_query: wraps SELECT into jsonb array
CREATE OR REPLACE FUNCTION public.execute_readonly_query(sql_query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  EXECUTE format(
    'SELECT COALESCE(jsonb_agg(row_to_json(t)), ''[]''::jsonb) FROM (%s) t',
    sql_query
  ) INTO result;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.execute_readonly_query(text) FROM public, anon, authenticated;

-- Create execute_write_fix: executes SQL and returns affected row count
CREATE OR REPLACE FUNCTION public.execute_write_fix(sql_query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  affected_rows integer;
BEGIN
  EXECUTE sql_query;
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'affected_rows', affected_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.execute_write_fix(text) FROM public, anon, authenticated;
```

## What This Fixes

- ARIA can execute `db_read_query` to inspect RLS policies, table schemas, and data
- ARIA can execute `db_write_fix` to apply safe SQL repairs (with confirm guard)
- The full autofix sequence (read_task -> db_read_query -> db_write_fix -> resolve_task) will work end-to-end

## Guards Preserved

- SECURITY DEFINER with `SET search_path TO 'public'` (prevents search_path hijacking)
- REVOKE from public/anon/authenticated (only service_role can call)
- Edge function guards unchanged: SELECT-only validation, multi-statement injection block, destructive pattern block, confirm flag requirement

## What Does NOT Change

- No edge function changes
- No UI changes  
- No other modules touched
- All existing code stays as-is

