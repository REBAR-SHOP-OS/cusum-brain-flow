
-- 1) QB Company Config (per-company defaults)
CREATE TABLE IF NOT EXISTS public.qb_company_config (
  company_id UUID PRIMARY KEY,
  default_income_account_id TEXT,
  default_tax_code TEXT DEFAULT 'TAX',
  default_payment_method TEXT,
  default_sales_term TEXT DEFAULT 'Net 30',
  use_qb_numbering BOOLEAN DEFAULT true,
  default_class_id TEXT,
  default_department_id TEXT,
  config JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.qb_company_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role access qb_company_config"
  ON public.qb_company_config FOR ALL USING (true) WITH CHECK (true);

-- 2) Reconciliation issues table
CREATE TABLE IF NOT EXISTS public.qb_reconciliation_issues (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  issue_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  qb_value JSONB,
  erp_value JSONB,
  severity TEXT DEFAULT 'warning',
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_qb_recon_company ON public.qb_reconciliation_issues(company_id, created_at DESC);
ALTER TABLE public.qb_reconciliation_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role access qb_reconciliation_issues"
  ON public.qb_reconciliation_issues FOR ALL USING (true) WITH CHECK (true);
