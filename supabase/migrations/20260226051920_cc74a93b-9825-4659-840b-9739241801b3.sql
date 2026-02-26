
-- stripe_payment_links table
CREATE TABLE public.stripe_payment_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  qb_invoice_id TEXT NOT NULL,
  invoice_number TEXT,
  customer_name TEXT,
  stripe_price_id TEXT,
  stripe_payment_link_id TEXT,
  stripe_url TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT DEFAULT 'cad',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.stripe_payment_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own company links" ON public.stripe_payment_links
  FOR ALL USING (
    company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
  );

-- email_collected_documents table
CREATE TABLE public.email_collected_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  email_id TEXT,
  gmail_message_id TEXT,
  document_type TEXT CHECK (document_type IN ('receipt', 'invoice', 'statement', 'payment_confirmation')),
  vendor_name TEXT,
  amount NUMERIC(12,2),
  currency TEXT DEFAULT 'CAD',
  document_date DATE,
  extracted_data JSONB DEFAULT '{}'::jsonb,
  attachment_url TEXT,
  status TEXT DEFAULT 'pending_review',
  qb_entity_id TEXT,
  qb_entity_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.email_collected_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own company docs" ON public.email_collected_documents
  FOR ALL USING (
    company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
  );
