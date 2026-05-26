-- Regression: detect permissive RLS predicates on public.* tables.
-- Run manually before publish, or pipe through supabase--read_query.
-- Expected result: zero rows. Any row returned is a violation of the
-- RLS Predicate Standard (see docs/security/policy-templates.md).

WITH allowlist(tablename) AS (
  VALUES
    -- Add genuinely-public read surfaces here. Each entry must also appear
    -- in docs/security/policy-templates.md and security_memory.
    ('__none_yet__')
)
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename NOT IN (SELECT tablename FROM allowlist)
  AND (
       qual       IN ('true', '(true)')
    OR with_check IN ('true', '(true)')
    OR qual       ILIKE '%auth.uid() IS NOT NULL%'
    OR with_check ILIKE '%auth.uid() IS NOT NULL%'
    OR qual       ILIKE '%auth.role() = ''authenticated''%'
    OR with_check ILIKE '%auth.role() = ''authenticated''%'
  )
ORDER BY tablename, policyname;
