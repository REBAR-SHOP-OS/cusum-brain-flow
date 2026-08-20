
-- bank_connections: stores Plaid-linked bank accounts
CREATE TABLE public.bank_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  institution_name text NOT NULL,
  plaid_item_id text NOT NULL,
  access_token_encrypted text NOT NULL,
  account_mask text,
  account_name text,
  account_type text,
  plaid_account_id text,
  linked_qb_account_id text,
  status text NOT NULL DEFAULT 'active',
  last_balance_sync timestamptz,
  last_balance numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company bank connections"
  ON public.bank_connections FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert own company bank connections"
  ON public.bank_connections FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can update own company bank connections"
  ON public.bank_connections FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()))
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Service role full access bank_connections"
  ON public.bank_connections FOR ALL TO service_role USING (true) WITH CHECK (true);

-- bank_transactions_live: read-only transaction feed from Plaid
CREATE TABLE public.bank_transactions_live (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES public.bank_connections(id) ON DELETE CASCADE,
  plaid_txn_id text UNIQUE,
  date date NOT NULL,
  description text,
  amount numeric NOT NULL,
  category text,
  pending boolean NOT NULL DEFAULT false,
  synced_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_transactions_live ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company bank transactions"
  ON public.bank_transactions_live FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Service role full access bank_transactions_live"
  ON public.bank_transactions_live FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX idx_bank_txn_company ON public.bank_transactions_live(company_id);
CREATE INDEX idx_bank_txn_connection ON public.bank_transactions_live(connection_id);
CREATE INDEX idx_bank_txn_date ON public.bank_transactions_live(date DESC);
CREATE INDEX idx_bank_connections_company ON public.bank_connections(company_id);
