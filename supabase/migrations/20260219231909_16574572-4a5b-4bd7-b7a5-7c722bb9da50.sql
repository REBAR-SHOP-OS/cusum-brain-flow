
-- Fix: pipeline_transition_log policies use 'public' role instead of 'authenticated'
DROP POLICY IF EXISTS "Users can view own company transition logs" ON public.pipeline_transition_log;
DROP POLICY IF EXISTS "Users can insert own company transition logs" ON public.pipeline_transition_log;

CREATE POLICY "Users can view own company transition logs"
ON public.pipeline_transition_log FOR SELECT TO authenticated
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert own company transition logs"
ON public.pipeline_transition_log FOR INSERT TO authenticated
WITH CHECK (company_id = get_user_company_id(auth.uid()));

-- Fix: pipeline_webhook_deliveries uses inline subquery instead of get_user_company_id
DROP POLICY IF EXISTS "Company members can view deliveries" ON public.pipeline_webhook_deliveries;

CREATE POLICY "Company members can view deliveries"
ON public.pipeline_webhook_deliveries FOR SELECT TO authenticated
USING (company_id = get_user_company_id(auth.uid())::text);

-- Fix: pipeline_webhooks policies use 'public' role and inline subqueries
DROP POLICY IF EXISTS "Company members can view webhooks" ON public.pipeline_webhooks;
DROP POLICY IF EXISTS "Admins can manage webhooks" ON public.pipeline_webhooks;

CREATE POLICY "Company members can view webhooks"
ON public.pipeline_webhooks FOR SELECT TO authenticated
USING (company_id = get_user_company_id(auth.uid())::text);

CREATE POLICY "Admins can manage webhooks"
ON public.pipeline_webhooks FOR ALL TO authenticated
USING (company_id = get_user_company_id(auth.uid())::text AND has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (company_id = get_user_company_id(auth.uid())::text AND has_role(auth.uid(), 'admin'::app_role));
