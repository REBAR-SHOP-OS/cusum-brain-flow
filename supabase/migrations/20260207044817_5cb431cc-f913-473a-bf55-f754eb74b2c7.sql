
-- Create a security definer function to get table stats
-- Only accessible by admin role users
CREATE OR REPLACE FUNCTION public.get_table_stats()
RETURNS TABLE (
  table_name text,
  approx_rows bigint,
  size_pretty text,
  size_bytes bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.relname::text AS table_name,
    c.reltuples::bigint AS approx_rows,
    pg_size_pretty(pg_total_relation_size(c.oid)) AS size_pretty,
    pg_total_relation_size(c.oid)::bigint AS size_bytes
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind = 'r'
    AND n.nspname = 'public'
  ORDER BY pg_total_relation_size(c.oid) DESC
  LIMIT 20;
$$;
