
-- ai_execution_log (company_id is TEXT)
DROP POLICY IF EXISTS "Authenticated users can read ai_execution_log" ON public.ai_execution_log;
CREATE POLICY "Authenticated users can read ai_execution_log"
  ON public.ai_execution_log FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid())::text);

-- ai_usage_log (company_id is TEXT)
DROP POLICY IF EXISTS "Authenticated users can read ai_usage_log" ON public.ai_usage_log;
CREATE POLICY "Authenticated users can read ai_usage_log"
  ON public.ai_usage_log FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid())::text);

-- companies (id is UUID)
DROP POLICY IF EXISTS "auth_read_companies" ON public.companies;
CREATE POLICY "auth_read_companies"
  ON public.companies FOR SELECT TO authenticated
  USING (id = get_user_company_id(auth.uid()));

DROP POLICY IF EXISTS "auth_insert_companies" ON public.companies;
CREATE POLICY "auth_insert_companies"
  ON public.companies FOR INSERT TO authenticated
  WITH CHECK (id = get_user_company_id(auth.uid()));

DROP POLICY IF EXISTS "auth_update_companies" ON public.companies;
CREATE POLICY "auth_update_companies"
  ON public.companies FOR UPDATE TO authenticated
  USING (id = get_user_company_id(auth.uid()))
  WITH CHECK (id = get_user_company_id(auth.uid()));

-- llm_company_budget (company_id is TEXT)
DROP POLICY IF EXISTS "Authenticated users can read budgets" ON public.llm_company_budget;
CREATE POLICY "Authenticated users can read budgets"
  ON public.llm_company_budget FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid())::text);

-- scopes_of_work (company_id is UUID)
DROP POLICY IF EXISTS "auth_read_scopes" ON public.scopes_of_work;
CREATE POLICY "auth_read_scopes"
  ON public.scopes_of_work FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));

DROP POLICY IF EXISTS "auth_insert_scopes" ON public.scopes_of_work;
CREATE POLICY "auth_insert_scopes"
  ON public.scopes_of_work FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id(auth.uid()));

DROP POLICY IF EXISTS "auth_update_scopes" ON public.scopes_of_work;
CREATE POLICY "auth_update_scopes"
  ON public.scopes_of_work FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()))
  WITH CHECK (company_id = get_user_company_id(auth.uid()));
