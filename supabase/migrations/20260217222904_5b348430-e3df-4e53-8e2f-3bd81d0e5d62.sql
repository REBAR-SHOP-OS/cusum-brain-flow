
-- Table for manually-entered bank feed balances
CREATE TABLE public.bank_feed_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id TEXT NOT NULL,
  account_name TEXT NOT NULL,
  bank_balance NUMERIC NOT NULL,
  last_updated TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  company_id UUID NOT NULL,
  UNIQUE (account_id, company_id)
);

-- Enable RLS
ALTER TABLE public.bank_feed_balances ENABLE ROW LEVEL SECURITY;

-- Company-scoped read
CREATE POLICY "Users can view bank balances for their company"
ON public.bank_feed_balances FOR SELECT
TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()));

-- Company-scoped insert
CREATE POLICY "Users can insert bank balances for their company"
ON public.bank_feed_balances FOR INSERT
TO authenticated
WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

-- Company-scoped update
CREATE POLICY "Users can update bank balances for their company"
ON public.bank_feed_balances FOR UPDATE
TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()));

-- Company-scoped delete
CREATE POLICY "Users can delete bank balances for their company"
ON public.bank_feed_balances FOR DELETE
TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()));
