-- Create a read-only SQL execution function for the Architect agent's db_read_query tool
CREATE OR REPLACE FUNCTION public.execute_readonly_query(sql_query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Validate: only SELECT/WITH
  IF NOT (upper(ltrim(sql_query)) LIKE 'SELECT%' OR upper(ltrim(sql_query)) LIKE 'WITH%') THEN
    RAISE EXCEPTION 'Only SELECT/WITH queries are allowed';
  END IF;
  
  EXECUTE 'SELECT jsonb_agg(row_to_json(t)) FROM (' || sql_query || ' LIMIT 50) t' INTO result;
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- Create a write SQL execution function for the Architect agent's db_write_fix tool
CREATE OR REPLACE FUNCTION public.execute_write_fix(sql_query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  affected_rows integer;
BEGIN
  -- Block destructive patterns
  IF sql_query ~* '(DROP\s+TABLE|DROP\s+DATABASE|TRUNCATE\s+|ALTER\s+TABLE\s+\S+\s+DROP\s+)' THEN
    RAISE EXCEPTION 'Destructive operations are blocked';
  END IF;
  
  EXECUTE sql_query;
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'affected_rows', affected_rows);
END;
$$;

-- Revoke public access — only service_role should call these
REVOKE ALL ON FUNCTION public.execute_readonly_query(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.execute_readonly_query(text) FROM anon;
REVOKE ALL ON FUNCTION public.execute_readonly_query(text) FROM authenticated;

REVOKE ALL ON FUNCTION public.execute_write_fix(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.execute_write_fix(text) FROM anon;
REVOKE ALL ON FUNCTION public.execute_write_fix(text) FROM authenticated;