
-- Create qb_bank_activity table for mirrored QB banking data
CREATE TABLE public.qb_bank_activity (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  qb_account_id TEXT NOT NULL,
  account_name TEXT NOT NULL,
  ledger_balance NUMERIC NOT NULL DEFAULT 0,
  bank_balance NUMERIC,
  unreconciled_count INTEGER NOT NULL DEFAULT 0,
  reconciled_through_date DATE,
  last_qb_sync_at TIMESTAMPTZ,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, qb_account_id)
);

-- Enable RLS
ALTER TABLE public.qb_bank_activity ENABLE ROW LEVEL SECURITY;

-- Company-scoped read
CREATE POLICY "Users can read their company bank activity"
ON public.qb_bank_activity FOR SELECT
USING (company_id = public.get_user_company_id(auth.uid()));

-- Company-scoped insert
CREATE POLICY "Users can insert their company bank activity"
ON public.qb_bank_activity FOR INSERT
WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

-- Company-scoped update
CREATE POLICY "Users can update their company bank activity"
ON public.qb_bank_activity FOR UPDATE
USING (company_id = public.get_user_company_id(auth.uid()));

-- Company-scoped delete
CREATE POLICY "Users can delete their company bank activity"
ON public.qb_bank_activity FOR DELETE
USING (company_id = public.get_user_company_id(auth.uid()));
