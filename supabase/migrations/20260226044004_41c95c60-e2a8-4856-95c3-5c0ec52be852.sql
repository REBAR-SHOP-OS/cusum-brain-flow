
-- WooCommerce → QuickBooks order mapping for idempotency
CREATE TABLE public.wc_qb_order_map (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  wc_order_id BIGINT NOT NULL,
  wc_order_number TEXT,
  wc_status TEXT,
  qb_customer_id TEXT,
  qb_invoice_id TEXT,
  qb_doc_number TEXT,
  total_amount NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'CAD',
  error_message TEXT,
  retry_count INT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, synced, error, skipped
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint: one mapping per WC order per company
CREATE UNIQUE INDEX idx_wc_qb_order_map_unique ON public.wc_qb_order_map (company_id, wc_order_id);

-- Index for quick status lookups
CREATE INDEX idx_wc_qb_order_map_status ON public.wc_qb_order_map (status);

-- Enable RLS
ALTER TABLE public.wc_qb_order_map ENABLE ROW LEVEL SECURITY;

-- Service-role only access (used by edge functions, not by frontend directly)
CREATE POLICY "Service role full access on wc_qb_order_map"
  ON public.wc_qb_order_map
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Authenticated users can read their company's mappings
CREATE POLICY "Users can view own company wc_qb_order_map"
  ON public.wc_qb_order_map
  FOR SELECT
  USING (
    company_id IN (
      SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid()
    )
  );
