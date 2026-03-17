
-- =============================================
-- SALES DEPARTMENT: 4 new isolated tables
-- =============================================

-- 1) sales_leads
CREATE TABLE public.sales_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  stage TEXT NOT NULL DEFAULT 'new',
  probability INTEGER DEFAULT 0,
  expected_value NUMERIC DEFAULT 0,
  expected_close_date DATE,
  source TEXT,
  assigned_to UUID,
  priority TEXT DEFAULT 'medium',
  notes TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  contact_company TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sales_leads_select" ON public.sales_leads FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "sales_leads_insert" ON public.sales_leads FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "sales_leads_update" ON public.sales_leads FOR UPDATE TO authenticated
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "sales_leads_delete" ON public.sales_leads FOR DELETE TO authenticated
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE INDEX idx_sales_leads_company ON public.sales_leads(company_id);
CREATE INDEX idx_sales_leads_stage ON public.sales_leads(stage);

ALTER PUBLICATION supabase_realtime ADD TABLE public.sales_leads;

-- 2) sales_contacts
CREATE TABLE public.sales_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  company_name TEXT,
  email TEXT,
  phone TEXT,
  source TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sales_contacts_select" ON public.sales_contacts FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "sales_contacts_insert" ON public.sales_contacts FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "sales_contacts_update" ON public.sales_contacts FOR UPDATE TO authenticated
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "sales_contacts_delete" ON public.sales_contacts FOR DELETE TO authenticated
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE INDEX idx_sales_contacts_company ON public.sales_contacts(company_id);

-- 3) sales_quotations
CREATE TABLE public.sales_quotations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  quotation_number TEXT NOT NULL,
  customer_name TEXT,
  customer_company TEXT,
  sales_lead_id UUID REFERENCES public.sales_leads(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  amount NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expiry_date DATE,
  UNIQUE(company_id, quotation_number)
);

ALTER TABLE public.sales_quotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sales_quotations_select" ON public.sales_quotations FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "sales_quotations_insert" ON public.sales_quotations FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "sales_quotations_update" ON public.sales_quotations FOR UPDATE TO authenticated
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "sales_quotations_delete" ON public.sales_quotations FOR DELETE TO authenticated
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE INDEX idx_sales_quotations_company ON public.sales_quotations(company_id);

-- 4) sales_invoices
CREATE TABLE public.sales_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  customer_name TEXT,
  customer_company TEXT,
  quotation_id UUID REFERENCES public.sales_quotations(id) ON DELETE SET NULL,
  sales_lead_id UUID REFERENCES public.sales_leads(id) ON DELETE SET NULL,
  amount NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  due_date DATE,
  issued_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, invoice_number)
);

ALTER TABLE public.sales_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sales_invoices_select" ON public.sales_invoices FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "sales_invoices_insert" ON public.sales_invoices FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "sales_invoices_update" ON public.sales_invoices FOR UPDATE TO authenticated
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "sales_invoices_delete" ON public.sales_invoices FOR DELETE TO authenticated
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE INDEX idx_sales_invoices_company ON public.sales_invoices(company_id);

-- Timestamp triggers
CREATE TRIGGER update_sales_leads_updated_at BEFORE UPDATE ON public.sales_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sales_contacts_updated_at BEFORE UPDATE ON public.sales_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
