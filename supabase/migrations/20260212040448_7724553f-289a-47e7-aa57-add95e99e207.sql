
-- Fix SELECT policy: company-scoped (was qual: true = data leak)
DROP POLICY IF EXISTS "Authenticated users can read suggestions" ON public.suggestions;
CREATE POLICY "Users read own company suggestions" ON public.suggestions
  FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid())::text);

-- Fix UPDATE policy: company-scoped (was shown_to check = cross-company mutation)
DROP POLICY IF EXISTS "Authenticated users can update own shown suggestions" ON public.suggestions;
CREATE POLICY "Users update own company suggestions" ON public.suggestions
  FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id(auth.uid())::text);

-- Dedup index to prevent race-condition duplicate suggestions
CREATE UNIQUE INDEX IF NOT EXISTS idx_suggestions_dedup
  ON public.suggestions(entity_type, entity_id, category)
  WHERE status IN ('open','new') AND entity_type IS NOT NULL;
