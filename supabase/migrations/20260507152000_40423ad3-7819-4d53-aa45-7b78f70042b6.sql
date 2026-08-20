-- Backfill the lone NULL workspace_settings row to the only existing company
UPDATE public.workspace_settings
SET company_id = (SELECT id FROM public.companies LIMIT 1)
WHERE company_id IS NULL;

-- Tighten workspace_settings policies: remove NULL escape hatch
ALTER TABLE public.workspace_settings ALTER COLUMN company_id SET NOT NULL;

DROP POLICY IF EXISTS "Company members can read workspace_settings" ON public.workspace_settings;
DROP POLICY IF EXISTS "Company members can update workspace_settings" ON public.workspace_settings;

CREATE POLICY "Company members can read workspace_settings"
ON public.workspace_settings
FOR SELECT
TO authenticated
USING (company_id = (public.get_user_company_id(auth.uid()))::text);

CREATE POLICY "Company members can update workspace_settings"
ON public.workspace_settings
FOR UPDATE
TO authenticated
USING (company_id = (public.get_user_company_id(auth.uid()))::text)
WITH CHECK (company_id = (public.get_user_company_id(auth.uid()))::text);