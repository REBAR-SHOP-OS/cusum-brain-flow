
-- Table to persist trial balance check results for hard-stop enforcement
CREATE TABLE public.trial_balance_checks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id TEXT NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_balanced BOOLEAN NOT NULL DEFAULT false,
  total_diff NUMERIC NOT NULL DEFAULT 0,
  qb_total NUMERIC NOT NULL DEFAULT 0,
  erp_total NUMERIC NOT NULL DEFAULT 0,
  ar_diff NUMERIC DEFAULT 0,
  ap_diff NUMERIC DEFAULT 0,
  details JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_trial_balance_checks_company ON public.trial_balance_checks (company_id, checked_at DESC);

-- Enable RLS
ALTER TABLE public.trial_balance_checks ENABLE ROW LEVEL SECURITY;

-- Only service_role can insert (from edge functions)
CREATE POLICY "Service role insert" ON public.trial_balance_checks
  FOR INSERT WITH CHECK (true);

-- Authenticated users with accounting/admin role can read
CREATE POLICY "Accounting users can read" ON public.trial_balance_checks
  FOR SELECT USING (
    public.has_any_role(auth.uid(), ARRAY['admin', 'accounting']::app_role[])
  );
