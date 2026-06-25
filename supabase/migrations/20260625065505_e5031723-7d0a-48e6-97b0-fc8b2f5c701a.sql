
-- =========================================================================
-- 1. bank_connections — restrict to admin/accounting and hide token column
-- =========================================================================
DROP POLICY IF EXISTS "Users can view own company bank connections" ON public.bank_connections;
DROP POLICY IF EXISTS "Users can insert own company bank connections" ON public.bank_connections;
DROP POLICY IF EXISTS "Users can update own company bank connections" ON public.bank_connections;

CREATE POLICY "Admins/accounting view company bank connections"
  ON public.bank_connections FOR SELECT TO authenticated
  USING (
    company_id = get_user_company_id(auth.uid())
    AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accounting'::app_role])
  );

CREATE POLICY "Admins/accounting insert company bank connections"
  ON public.bank_connections FOR INSERT TO authenticated
  WITH CHECK (
    company_id = get_user_company_id(auth.uid())
    AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accounting'::app_role])
  );

CREATE POLICY "Admins/accounting update company bank connections"
  ON public.bank_connections FOR UPDATE TO authenticated
  USING (
    company_id = get_user_company_id(auth.uid())
    AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accounting'::app_role])
  )
  WITH CHECK (
    company_id = get_user_company_id(auth.uid())
    AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accounting'::app_role])
  );

-- Defense-in-depth: hide the encrypted token column from authenticated/anon
REVOKE SELECT (access_token_encrypted) ON public.bank_connections FROM authenticated;
REVOKE SELECT (access_token_encrypted) ON public.bank_connections FROM anon;

-- =========================================================================
-- 2. cameras — hide password column from clients (service_role only)
-- =========================================================================
REVOKE SELECT (password) ON public.cameras FROM authenticated;
REVOKE SELECT (password) ON public.cameras FROM anon;

-- =========================================================================
-- 3. deliveries — drop overly broad UPDATE/DELETE policies missing company_id
-- =========================================================================
DROP POLICY IF EXISTS "Office field workshop can update deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Staff can delete deliveries" ON public.deliveries;

-- =========================================================================
-- 4. delivery_stops — drop overly broad DELETE policy missing company_id
-- =========================================================================
DROP POLICY IF EXISTS "Staff can delete delivery_stops" ON public.delivery_stops;

-- =========================================================================
-- 5. feature_flags — force RLS, revoke anon access
-- =========================================================================
ALTER TABLE public.feature_flags FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.feature_flags FROM anon;
REVOKE ALL ON public.feature_flags FROM PUBLIC;

-- =========================================================================
-- 6. integration_settings — add company_id and scope policies per tenant
-- =========================================================================
ALTER TABLE public.integration_settings
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_integration_settings_company_id
  ON public.integration_settings(company_id);

DROP POLICY IF EXISTS "Admin can delete integration_settings" ON public.integration_settings;
DROP POLICY IF EXISTS "Admin can insert integration_settings" ON public.integration_settings;
DROP POLICY IF EXISTS "Admin can read integration_settings" ON public.integration_settings;
DROP POLICY IF EXISTS "Admin can update integration_settings" ON public.integration_settings;

CREATE POLICY "Company admins read integration_settings"
  ON public.integration_settings FOR SELECT TO authenticated
  USING (
    company_id IS NOT NULL
    AND company_id = get_user_company_id(auth.uid())
    AND has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Company admins insert integration_settings"
  ON public.integration_settings FOR INSERT TO authenticated
  WITH CHECK (
    company_id IS NOT NULL
    AND company_id = get_user_company_id(auth.uid())
    AND has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Company admins update integration_settings"
  ON public.integration_settings FOR UPDATE TO authenticated
  USING (
    company_id IS NOT NULL
    AND company_id = get_user_company_id(auth.uid())
    AND has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    company_id IS NOT NULL
    AND company_id = get_user_company_id(auth.uid())
    AND has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Company admins delete integration_settings"
  ON public.integration_settings FOR DELETE TO authenticated
  USING (
    company_id IS NOT NULL
    AND company_id = get_user_company_id(auth.uid())
    AND has_role(auth.uid(), 'admin'::app_role)
  );

-- =========================================================================
-- 7. realtime.messages — fail-closed default policy (no broadcast/presence)
-- =========================================================================
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny all realtime broadcast/presence by default" ON realtime.messages;
CREATE POLICY "Deny all realtime broadcast/presence by default"
  ON realtime.messages FOR ALL TO authenticated, anon
  USING (false) WITH CHECK (false);
