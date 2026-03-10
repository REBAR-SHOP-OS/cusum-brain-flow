
-- 1. Add company_id (uuid) to extract_rows and extract_errors
ALTER TABLE public.extract_rows ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.extract_errors ADD COLUMN IF NOT EXISTS company_id uuid;

-- 2. Backfill from extract_sessions
UPDATE public.extract_rows r
SET company_id = s.company_id
FROM public.extract_sessions s
WHERE r.session_id = s.id AND r.company_id IS NULL;

UPDATE public.extract_errors e
SET company_id = s.company_id
FROM public.extract_sessions s
WHERE e.session_id = s.id AND e.company_id IS NULL;

-- 3. Replace extract_rows policies with direct company_id check
DROP POLICY IF EXISTS "Users can view rows via session company" ON public.extract_rows;
CREATE POLICY "Users can view rows via session company"
  ON public.extract_rows FOR SELECT
  USING (company_id = get_user_company_id(auth.uid()));

DROP POLICY IF EXISTS "Office and admin can update rows" ON public.extract_rows;
CREATE POLICY "Office and admin can update rows"
  ON public.extract_rows FOR UPDATE
  USING (company_id = get_user_company_id(auth.uid())
    AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'office'::app_role]));

DROP POLICY IF EXISTS "Admin can delete rows" ON public.extract_rows;
CREATE POLICY "Admin can delete rows"
  ON public.extract_rows FOR DELETE
  USING (company_id = get_user_company_id(auth.uid())
    AND has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Office and admin can insert rows" ON public.extract_rows;
CREATE POLICY "Office and admin can insert rows"
  ON public.extract_rows FOR INSERT
  WITH CHECK (company_id = get_user_company_id(auth.uid())
    AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'office'::app_role]));

-- 4. Replace extract_errors policies
DROP POLICY IF EXISTS "Users can view errors via session company" ON public.extract_errors;
CREATE POLICY "Users can view errors via session company"
  ON public.extract_errors FOR SELECT
  USING (company_id = get_user_company_id(auth.uid()));

DROP POLICY IF EXISTS "Office and admin can update errors" ON public.extract_errors;
CREATE POLICY "Office and admin can update errors"
  ON public.extract_errors FOR UPDATE
  USING (company_id = get_user_company_id(auth.uid())
    AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'office'::app_role]));

DROP POLICY IF EXISTS "Admin can delete errors" ON public.extract_errors;
CREATE POLICY "Admin can delete errors"
  ON public.extract_errors FOR DELETE
  USING (company_id = get_user_company_id(auth.uid())
    AND has_role(auth.uid(), 'admin'::app_role));
