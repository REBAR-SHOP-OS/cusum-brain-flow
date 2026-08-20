-- Restrict get_table_stats() to admin role only
-- This is the only SECURITY DEFINER function that doesn't need to be callable by all users
CREATE OR REPLACE FUNCTION public.get_table_stats()
 RETURNS TABLE(table_name text, approx_rows bigint, size_pretty text, size_bytes bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    c.relname::text AS table_name,
    c.reltuples::bigint AS approx_rows,
    pg_size_pretty(pg_total_relation_size(c.oid)) AS size_pretty,
    pg_total_relation_size(c.oid)::bigint AS size_bytes
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind = 'r'
    AND n.nspname = 'public'
    AND public.has_role(auth.uid(), 'admin'::app_role)
  ORDER BY pg_total_relation_size(c.oid) DESC
  LIMIT 20;
$function$;

-- Revoke execute from public, grant only to authenticated
REVOKE EXECUTE ON FUNCTION public.get_table_stats() FROM public;
REVOKE EXECUTE ON FUNCTION public.get_table_stats() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_table_stats() TO authenticated;