
-- =============================================
-- Sales Department Max-Tech DB Migration
-- =============================================

-- 1. sales_leads: Add tracking columns
ALTER TABLE public.sales_leads 
  ADD COLUMN IF NOT EXISTS last_activity_date timestamptz,
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS lost_reason text;

-- 2. sales_contacts: Add CRM fields
ALTER TABLE public.sales_contacts
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS address text;

-- 3. sales_invoices: Add payment tracking
ALTER TABLE public.sales_invoices
  ADD COLUMN IF NOT EXISTS paid_date date,
  ADD COLUMN IF NOT EXISTS payment_method text;

-- 4. Create sales_quotation_items table
CREATE TABLE IF NOT EXISTS public.sales_quotation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid NOT NULL REFERENCES public.sales_quotations(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  description text NOT NULL DEFAULT '',
  quantity numeric NOT NULL DEFAULT 1,
  unit text DEFAULT 'ea',
  unit_price numeric NOT NULL DEFAULT 0,
  total numeric GENERATED ALWAYS AS (quantity * unit_price) STORED,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_quotation_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company quotation items"
  ON public.sales_quotation_items FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own company quotation items"
  ON public.sales_quotation_items FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own company quotation items"
  ON public.sales_quotation_items FOR UPDATE
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete own company quotation items"
  ON public.sales_quotation_items FOR DELETE
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- 5. Create sales_invoice_items table
CREATE TABLE IF NOT EXISTS public.sales_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.sales_invoices(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  description text NOT NULL DEFAULT '',
  quantity numeric NOT NULL DEFAULT 1,
  unit text DEFAULT 'ea',
  unit_price numeric NOT NULL DEFAULT 0,
  total numeric GENERATED ALWAYS AS (quantity * unit_price) STORED,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company invoice items"
  ON public.sales_invoice_items FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own company invoice items"
  ON public.sales_invoice_items FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own company invoice items"
  ON public.sales_invoice_items FOR UPDATE
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete own company invoice items"
  ON public.sales_invoice_items FOR DELETE
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- 6. Enable realtime for line item tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales_quotation_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales_invoice_items;
