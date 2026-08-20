CREATE OR REPLACE FUNCTION public.execute_write_fix(sql_query text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  affected_rows integer;
  stmt_count integer;
BEGIN
  -- Guard: reject multiple statements
  SELECT COUNT(*) INTO stmt_count
  FROM regexp_split_to_table(regexp_replace(sql_query, '--[^\n]*', '', 'g'), ';') s
  WHERE trim(s) != '';

  IF stmt_count > 1 THEN
    RETURN jsonb_build_object('error', 'Only single SQL statements allowed');
  END IF;

  -- Guard: max query length
  IF length(sql_query) > 4000 THEN
    RETURN jsonb_build_object('error', 'Query exceeds 4000 character limit');
  END IF;

  EXECUTE sql_query;
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'affected_rows', affected_rows);
END;
$$;