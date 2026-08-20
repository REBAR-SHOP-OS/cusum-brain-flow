
-- Finding 1: Fix wwm_standards policy to target authenticated only
DROP POLICY IF EXISTS "Admins can manage wwm standards" ON public.wwm_standards;
CREATE POLICY "Admins can manage wwm standards"
  ON public.wwm_standards
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'::app_role
  ));

-- Finding 2a: Harden execute_readonly_query
CREATE OR REPLACE FUNCTION public.execute_readonly_query(sql_query text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  normalized text;
BEGIN
  normalized := lower(sql_query);

  -- Block sensitive tables
  IF normalized ~* '(user_gmail_tokens|user_ringcentral_tokens|user_meta_tokens|auth\.)' THEN
    RAISE EXCEPTION 'Access to sensitive tables denied';
  END IF;

  -- Block DDL commands
  IF normalized ~* '\b(DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE)\b' THEN
    RAISE EXCEPTION 'DDL commands not allowed';
  END IF;

  -- Enforce SELECT-only
  IF NOT (normalized ~* '^\s*select\b') THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;

  EXECUTE format(
    'SELECT COALESCE(jsonb_agg(row_to_json(t)), ''[]''::jsonb) FROM (%s) t',
    sql_query
  ) INTO result;
  RETURN result;
END;
$function$;

-- Finding 2b: Harden execute_write_fix
CREATE OR REPLACE FUNCTION public.execute_write_fix(sql_query text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  affected_rows integer;
  stmt_count integer;
  normalized text;
BEGIN
  normalized := lower(sql_query);

  -- Block sensitive tables
  IF normalized ~* '(user_gmail_tokens|user_ringcentral_tokens|user_meta_tokens|auth\.)' THEN
    RAISE EXCEPTION 'Access to sensitive tables denied';
  END IF;

  -- Block DDL commands
  IF normalized ~* '\b(DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE)\b' THEN
    RAISE EXCEPTION 'DDL commands not allowed';
  END IF;

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
$function$;
