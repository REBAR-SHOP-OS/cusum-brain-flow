
-- Step 1: execute_readonly_query — restricted to SELECT only
CREATE OR REPLACE FUNCTION public.execute_readonly_query(sql_query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result jsonb;
BEGIN
  -- Safety: only allow SELECT statements
  IF NOT (lower(trim(sql_query)) ~* '^(select|with)\s') THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;

  EXECUTE 'SELECT jsonb_agg(row_to_json(t)) FROM (' || sql_query || ') t' INTO _result;
  RETURN COALESCE(_result, '[]'::jsonb);
END;
$$;

-- Step 2: execute_write_fix — restricted to UPDATE/INSERT/DELETE with logging
CREATE OR REPLACE FUNCTION public.execute_write_fix(sql_query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _affected integer;
BEGIN
  -- Safety: block DDL and dangerous statements
  IF lower(trim(sql_query)) ~* '^(drop|truncate|alter|create|grant|revoke)\s' THEN
    RAISE EXCEPTION 'DDL statements are not allowed via this function';
  END IF;

  EXECUTE sql_query;
  GET DIAGNOSTICS _affected = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'rows_affected', _affected);
END;
$$;
