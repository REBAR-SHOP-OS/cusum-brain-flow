-- Secure workspace_settings by company and role, and normalize legacy singleton rows.

WITH template AS (
  SELECT
    timezone,
    date_format,
    time_format
  FROM public.workspace_settings
  ORDER BY updated_at DESC NULLS LAST, id DESC
  LIMIT 1
),
company_rows AS (
  SELECT DISTINCT p.company_id::text AS company_id
  FROM public.profiles p
  WHERE p.company_id IS NOT NULL
)
INSERT INTO public.workspace_settings (company_id, timezone, date_format, time_format)
SELECT
  c.company_id,
  COALESCE(t.timezone, 'America/Toronto'),
  COALESCE(t.date_format, 'MM/dd/yyyy'),
  COALESCE(t.time_format, '12h')
FROM company_rows c
LEFT JOIN template t ON TRUE
WHERE NOT EXISTS (
  SELECT 1
  FROM public.workspace_settings ws
  WHERE ws.company_id = c.company_id
);

DELETE FROM public.workspace_settings ws
USING public.workspace_settings newer
WHERE ws.company_id IS NOT NULL
  AND newer.company_id = ws.company_id
  AND (
    newer.updated_at > ws.updated_at
    OR (newer.updated_at = ws.updated_at AND newer.id > ws.id)
  );

DELETE FROM public.workspace_settings
WHERE company_id IS NULL;

ALTER TABLE public.workspace_settings
  ALTER COLUMN company_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS workspace_settings_company_id_key
  ON public.workspace_settings (company_id);

DROP POLICY IF EXISTS "Authenticated users can read workspace_settings"
  ON public.workspace_settings;

DROP POLICY IF EXISTS "Authenticated users can update workspace_settings"
  ON public.workspace_settings;

CREATE POLICY "Users can read workspace_settings in their company"
  ON public.workspace_settings
  FOR SELECT
  TO authenticated
  USING (
    company_id = public.get_user_company_id(auth.uid())::text
  );

CREATE POLICY "Admins and office can insert workspace_settings in their company"
  ON public.workspace_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.get_user_company_id(auth.uid())::text
    AND public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'office'::app_role])
  );

CREATE POLICY "Admins and office can update workspace_settings in their company"
  ON public.workspace_settings
  FOR UPDATE
  TO authenticated
  USING (
    company_id = public.get_user_company_id(auth.uid())::text
    AND public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'office'::app_role])
  )
  WITH CHECK (
    company_id = public.get_user_company_id(auth.uid())::text
    AND public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'office'::app_role])
  );
