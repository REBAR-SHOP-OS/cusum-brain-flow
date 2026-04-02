-- Harden RLS on suggestions, workspace_settings, and ai_usage_log.

-- ============================================
-- suggestions
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can read suggestions" ON public.suggestions;
DROP POLICY IF EXISTS "System can insert suggestions" ON public.suggestions;
DROP POLICY IF EXISTS "Users can update suggestion status" ON public.suggestions;

CREATE POLICY "Users can read company suggestions"
  ON public.suggestions
  FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id(auth.uid())::text);

CREATE POLICY "Service role can insert suggestions"
  ON public.suggestions
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Users can update own shown suggestions"
  ON public.suggestions
  FOR UPDATE
  TO authenticated
  USING (
    company_id = get_user_company_id(auth.uid())::text
    AND (
      shown_to IS NULL
      OR shown_to = auth.uid()
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'office'::app_role)
    )
  )
  WITH CHECK (company_id = get_user_company_id(auth.uid())::text);

-- ============================================
-- workspace_settings
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can read workspace_settings" ON public.workspace_settings;
DROP POLICY IF EXISTS "Authenticated users can update workspace_settings" ON public.workspace_settings;

CREATE POLICY "Users can read workspace_settings for own company"
  ON public.workspace_settings
  FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id(auth.uid())::text);

CREATE POLICY "Admin and office can update workspace_settings for own company"
  ON public.workspace_settings
  FOR UPDATE
  TO authenticated
  USING (
    company_id = get_user_company_id(auth.uid())::text
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'office'::app_role)
    )
  )
  WITH CHECK (company_id = get_user_company_id(auth.uid())::text);

-- Keep existing seed row, but ensure company_id is set for tenant-safe reads.
UPDATE public.workspace_settings
SET company_id = get_user_company_id(auth.uid())::text
WHERE company_id IS NULL;

-- ============================================
-- ai_usage_log
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can read ai_usage_log" ON public.ai_usage_log;

CREATE POLICY "Admins can read own company ai_usage_log"
  ON public.ai_usage_log
  FOR SELECT
  TO authenticated
  USING (
    company_id = get_user_company_id(auth.uid())::text
    AND has_role(auth.uid(), 'admin'::app_role)
  );
