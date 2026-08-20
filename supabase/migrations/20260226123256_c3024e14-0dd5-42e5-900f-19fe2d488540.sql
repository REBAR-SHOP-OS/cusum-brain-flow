
-- Create stripe_qb_sync_map table for Stripe → QuickBooks sync idempotency
CREATE TABLE public.stripe_qb_sync_map (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  stripe_payment_intent_id TEXT NOT NULL,
  stripe_session_id TEXT,
  stripe_customer_id TEXT,
  customer_email TEXT,
  qb_customer_id TEXT,
  qb_invoice_id TEXT,
  qb_payment_id TEXT,
  qb_doc_number TEXT,
  total_amount NUMERIC,
  currency TEXT DEFAULT 'CAD',
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  retry_count INT DEFAULT 0,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint for idempotency
CREATE UNIQUE INDEX idx_stripe_qb_sync_map_unique ON public.stripe_qb_sync_map (company_id, stripe_payment_intent_id);

-- Enable RLS
ALTER TABLE public.stripe_qb_sync_map ENABLE ROW LEVEL SECURITY;

-- Authenticated users can SELECT rows for their company
CREATE POLICY "Users can view their company sync records"
  ON public.stripe_qb_sync_map
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_stripe_qb_sync_map_updated_at
  BEFORE UPDATE ON public.stripe_qb_sync_map
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
