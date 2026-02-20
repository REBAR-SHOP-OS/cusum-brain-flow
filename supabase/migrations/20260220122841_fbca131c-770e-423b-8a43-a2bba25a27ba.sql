
-- =============================================
-- Security Hardening: Fix overly permissive RLS
-- =============================================

-- 1. automation_configs: drop USING(true) policy, recreate for service_role
DROP POLICY "Service role full access automation_configs" ON public.automation_configs;
CREATE POLICY "Service role full access automation_configs" ON public.automation_configs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. automation_runs: drop USING(true) policy, recreate for service_role
DROP POLICY "Service role full access automation_runs" ON public.automation_runs;
CREATE POLICY "Service role full access automation_runs" ON public.automation_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. customer_health_scores: drop USING(true) policy, recreate for service_role
DROP POLICY "Service role full access health_scores" ON public.customer_health_scores;
CREATE POLICY "Service role full access health_scores" ON public.customer_health_scores
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. document_embeddings: drop USING(true) policy, recreate for service_role
DROP POLICY "Service role can manage embeddings" ON public.document_embeddings;
CREATE POLICY "Service role can manage embeddings" ON public.document_embeddings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5. estimation_learnings: drop USING(true) insert policy, recreate for service_role
DROP POLICY "Service role can insert learnings" ON public.estimation_learnings;
CREATE POLICY "Service role can insert learnings" ON public.estimation_learnings
  FOR INSERT TO service_role WITH CHECK (true);

-- 6. ingestion_progress: drop 3 permissive public policies, recreate for service_role
DROP POLICY "Service insert ingestion progress" ON public.ingestion_progress;
DROP POLICY "Service role can manage ingestion progress" ON public.ingestion_progress;
DROP POLICY "Service update ingestion progress" ON public.ingestion_progress;
CREATE POLICY "Service role can manage ingestion progress" ON public.ingestion_progress
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 7. project_coordination_log: drop 2 permissive public policies, recreate for service_role
DROP POLICY "Service role can insert coordination logs" ON public.project_coordination_log;
DROP POLICY "Service role can update coordination logs" ON public.project_coordination_log;
CREATE POLICY "Service role can manage coordination logs" ON public.project_coordination_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 8. rc_presence: drop USING(true) policy, recreate for service_role
DROP POLICY "Service role manages presence" ON public.rc_presence;
CREATE POLICY "Service role manages presence" ON public.rc_presence
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 9. kb_articles: remove anon policy (public exposure)
DROP POLICY "Published articles are publicly readable" ON public.kb_articles;

-- 10. rebar_standards: restrict public read to authenticated
DROP POLICY "Allow read rebar standards" ON public.rebar_standards;
CREATE POLICY "Authenticated can read rebar standards" ON public.rebar_standards
  FOR SELECT TO authenticated USING (true);

-- 11. wwm_standards: restrict public read to authenticated
DROP POLICY "Allow read wwm standards" ON public.wwm_standards;
CREATE POLICY "Authenticated can read wwm standards" ON public.wwm_standards
  FOR SELECT TO authenticated USING (true);

-- 12. estimation_validation_rules: restrict public read to authenticated
DROP POLICY "Allow read validation rules" ON public.estimation_validation_rules;
CREATE POLICY "Authenticated can read validation rules" ON public.estimation_validation_rules
  FOR SELECT TO authenticated USING (true);

-- 13. rebar_sizes: restrict public read to authenticated
DROP POLICY "Anyone can read rebar_sizes" ON public.rebar_sizes;
CREATE POLICY "Authenticated can read rebar_sizes" ON public.rebar_sizes
  FOR SELECT TO authenticated USING (true);

-- 14. Move vector extension from public to extensions schema
ALTER EXTENSION vector SET SCHEMA extensions;
