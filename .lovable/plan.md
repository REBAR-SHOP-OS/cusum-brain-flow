
# Fix: Why ARIA Still Can't Fix Database Issues

## Root Cause

The `execute_readonly_query` database function is **fundamentally broken**. It uses:

```sql
EXECUTE sql_query INTO result;
RETURN result;
```

The `INTO result` clause expects a **single jsonb value**, but normal SELECT queries (like `SELECT * FROM pg_policies WHERE tablename = 'team_channels'`) return **row sets**, not a single jsonb scalar. Result: the function returns `NULL` for every query the agent runs. The agent gets empty data, can't diagnose anything, and falls back to "I couldn't process that request."

## Solution (Surgical — 1 migration only)

Replace `execute_readonly_query` with a function that properly wraps multi-row results into a jsonb array using `row_to_json` + `json_agg`. No edge function changes needed — the callers already handle jsonb output correctly.

Also fix `execute_write_fix` to return affected row count for better agent feedback.

### What Changes

| Target | Change |
|--------|--------|
| SQL Migration | Replace `execute_readonly_query` to return proper row-set results as jsonb array |
| SQL Migration | Improve `execute_write_fix` to return row count on success |

### What Does NOT Change

- No edge function changes (callers already handle jsonb)
- No UI changes
- No other modules touched
- All existing guards, throttling, and safety checks preserved

## Technical Details

### Fixed `execute_readonly_query`

```sql
CREATE OR REPLACE FUNCTION public.execute_readonly_query(sql_query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Wrap the user query to aggregate all rows into a jsonb array
  EXECUTE format(
    'SELECT COALESCE(jsonb_agg(row_to_json(t)), ''[]''::jsonb) FROM (%s) t',
    sql_query
  ) INTO result;
  RETURN result;
END;
$$;

-- Keep restricted to service_role only
REVOKE ALL ON FUNCTION public.execute_readonly_query(text) FROM public, anon, authenticated;
```

This wraps any SELECT into `jsonb_agg(row_to_json(...))`, so the result is always a jsonb array (e.g., `[{"tablename":"team_channels","policyname":"...","cmd":"SELECT",...}, ...]`). The agent gets real data instead of NULL.

### Fixed `execute_write_fix`

```sql
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

### Why This Fixes ARIA

1. Agent calls `db_read_query` with `SELECT * FROM pg_policies WHERE tablename = 'team_channels'`
2. Edge function calls `execute_readonly_query` RPC
3. Function now returns `[{"tablename":"team_channels","policyname":"...","cmd":"SELECT","qual":"..."}]` instead of `NULL`
4. Agent sees actual RLS policies, diagnoses the issue, and applies the fix using `db_write_fix`
5. `db_write_fix` returns `{"success": true, "affected_rows": 1}` instead of just `{"success": true}`

### Guards Preserved

- SECURITY DEFINER with `SET search_path TO 'public'` (prevents search_path hijacking)
- REVOKE from public/anon/authenticated (only service_role can call)
- All existing edge function guards unchanged (multi-statement injection check, destructive pattern block, confirm flag requirement)
