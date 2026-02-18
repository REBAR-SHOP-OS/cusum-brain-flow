
-- Fix execute_readonly_query to properly return multi-row results as jsonb array
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

-- Fix execute_write_fix to return affected row count
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
