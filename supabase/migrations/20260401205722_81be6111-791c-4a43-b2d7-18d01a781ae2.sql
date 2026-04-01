
-- TIER 1: Fix critical public-write RLS policies

-- 1. qb_api_failures — drop public policy, recreate as service_role
DROP POLICY "Service role full access qb_api_failures" ON public.qb_api_failures;
CREATE POLICY "Service role full access qb_api_failures"
  ON public.qb_api_failures FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2. qb_company_config — drop public policy, recreate as service_role
DROP POLICY "Service role access qb_company_config" ON public.qb_company_config;
CREATE POLICY "Service role access qb_company_config"
  ON public.qb_company_config FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3. qb_reconciliation_issues — drop public policy, recreate as service_role
DROP POLICY "Service role access qb_reconciliation_issues" ON public.qb_reconciliation_issues;
CREATE POLICY "Service role access qb_reconciliation_issues"
  ON public.qb_reconciliation_issues FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 4. qb_sync_locks — drop public policy, recreate as service_role
DROP POLICY "Service role full access qb_sync_locks" ON public.qb_sync_locks;
CREATE POLICY "Service role full access qb_sync_locks"
  ON public.qb_sync_locks FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 5. document_embeddings — drop public read, add authenticated company-scoped
DROP POLICY "Company users can read embeddings" ON public.document_embeddings;
CREATE POLICY "Authenticated users can read own company embeddings"
  ON public.document_embeddings FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));
