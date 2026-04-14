-- ─────────────────────────────────────────────────────────────────────────────
-- Security Audit: RLS Hardening
-- Closes the "Remaining work" items from docs/security/RLS_AND_EDGE_AUDIT.md
--
-- Changes:
--   1. qb_company_config   — replace USING(true) with company_id-scoped policy
--   2. qb_reconciliation_issues — same
--   3. leads               — drop anon SELECT (PII exposure, not used by any public page)
--   4. customers           — drop anon SELECT (PII exposure, not used by any public page)
--   5. lead_files          — drop anon SELECT (PII exposure)
--
-- Public pages (CustomerPortal, AcceptQuote, VendorPortal) reach these tables
-- through service-role edge functions only, so removing anon policies is safe.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. qb_company_config ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Service role access qb_company_config" ON public.qb_company_config;

-- Service role keeps full access (used by qb-sync-engine, qb-audit, etc.)
CREATE POLICY "Service role full access qb_company_config"
  ON public.qb_company_config
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can only see/update their own company config
CREATE POLICY "Company members access qb_company_config"
  ON public.qb_company_config
  FOR ALL
  TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()))
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

-- ── 2. qb_reconciliation_issues ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Service role access qb_reconciliation_issues" ON public.qb_reconciliation_issues;

CREATE POLICY "Service role full access qb_reconciliation_issues"
  ON public.qb_reconciliation_issues
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Company members read qb_reconciliation_issues"
  ON public.qb_reconciliation_issues
  FOR SELECT
  TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

-- Accounting/admin roles may write (create/update/resolve issues)
CREATE POLICY "Accounting write qb_reconciliation_issues"
  ON public.qb_reconciliation_issues
  FOR ALL
  TO authenticated
  USING (
    company_id = public.get_user_company_id(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'accounting')
    )
  )
  WITH CHECK (
    company_id = public.get_user_company_id(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'accounting')
    )
  );

-- ── 3. leads — drop anon SELECT ───────────────────────────────────────────────
-- Rationale: all public-facing reads go through service-role edge functions.
-- An anon SELECT on the leads table exposes contact names, emails, phone numbers
-- and company information for ALL tenants to any unauthenticated request.
DROP POLICY IF EXISTS "Allow anon read access for leads" ON public.leads;

-- ── 4. customers — drop anon SELECT ──────────────────────────────────────────
DROP POLICY IF EXISTS "Allow anon read access for customers" ON public.customers;

-- ── 5. lead_files — drop anon SELECT ─────────────────────────────────────────
DROP POLICY IF EXISTS "Anon can read lead files" ON public.lead_files;
