
-- ============================================================
-- PHASE 1: Core QB Mirror Tables
-- ============================================================

-- 1. qb_company_info
CREATE TABLE public.qb_company_info (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  qb_realm_id TEXT NOT NULL,
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, qb_realm_id)
);

-- 2. qb_accounts
CREATE TABLE public.qb_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  qb_realm_id TEXT NOT NULL,
  qb_id TEXT NOT NULL,
  sync_token TEXT,
  name TEXT,
  account_type TEXT,
  account_sub_type TEXT,
  current_balance NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_deleted BOOLEAN DEFAULT false,
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, qb_id)
);

-- 3. qb_customers
CREATE TABLE public.qb_customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  qb_realm_id TEXT NOT NULL,
  qb_id TEXT NOT NULL,
  sync_token TEXT,
  display_name TEXT,
  company_name TEXT,
  balance NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_deleted BOOLEAN DEFAULT false,
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, qb_id)
);

-- 4. qb_vendors
CREATE TABLE public.qb_vendors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  qb_realm_id TEXT NOT NULL,
  qb_id TEXT NOT NULL,
  sync_token TEXT,
  display_name TEXT,
  company_name TEXT,
  balance NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_deleted BOOLEAN DEFAULT false,
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, qb_id)
);

-- 5. qb_items
CREATE TABLE public.qb_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  qb_realm_id TEXT NOT NULL,
  qb_id TEXT NOT NULL,
  sync_token TEXT,
  name TEXT,
  type TEXT,
  unit_price NUMERIC DEFAULT 0,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  is_deleted BOOLEAN DEFAULT false,
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, qb_id)
);

-- 6. qb_transactions (generic raw store for all QB transaction types)
CREATE TABLE public.qb_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  qb_realm_id TEXT NOT NULL,
  qb_id TEXT NOT NULL,
  entity_type TEXT NOT NULL, -- Invoice, Bill, Payment, CreditMemo, JournalEntry, Estimate, PurchaseOrder, Deposit, Transfer, VendorCredit, SalesReceipt
  sync_token TEXT,
  txn_date DATE,
  doc_number TEXT,
  total_amt NUMERIC DEFAULT 0,
  balance NUMERIC DEFAULT 0,
  customer_qb_id TEXT,
  vendor_qb_id TEXT,
  is_voided BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, qb_id, entity_type)
);

-- ============================================================
-- PHASE 2: General Ledger Tables
-- ============================================================

-- 7. gl_transactions
CREATE TABLE public.gl_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  source TEXT NOT NULL DEFAULT 'quickbooks',
  qb_transaction_id UUID REFERENCES public.qb_transactions(id) ON DELETE SET NULL,
  entity_type TEXT,
  txn_date DATE,
  currency TEXT DEFAULT 'USD',
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. gl_lines
CREATE TABLE public.gl_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gl_transaction_id UUID NOT NULL REFERENCES public.gl_transactions(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.qb_accounts(id) ON DELETE SET NULL,
  debit NUMERIC NOT NULL DEFAULT 0,
  credit NUMERIC NOT NULL DEFAULT 0,
  customer_id UUID REFERENCES public.qb_customers(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES public.qb_vendors(id) ON DELETE SET NULL,
  class_id TEXT,
  location_id TEXT,
  description TEXT
);

-- ============================================================
-- PHASE 4: Sync Logs
-- ============================================================

-- 9. qb_sync_logs
CREATE TABLE public.qb_sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  entity_type TEXT,
  action TEXT NOT NULL, -- backfill, incremental, reconcile
  qb_ids_processed TEXT[] DEFAULT '{}',
  synced_count INT DEFAULT 0,
  error_count INT DEFAULT 0,
  errors TEXT[] DEFAULT '{}',
  duration_ms INT DEFAULT 0,
  trial_balance_diff NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_qb_accounts_company ON public.qb_accounts(company_id);
CREATE INDEX idx_qb_accounts_type ON public.qb_accounts(account_type);
CREATE INDEX idx_qb_customers_company ON public.qb_customers(company_id);
CREATE INDEX idx_qb_vendors_company ON public.qb_vendors(company_id);
CREATE INDEX idx_qb_items_company ON public.qb_items(company_id);
CREATE INDEX idx_qb_transactions_company ON public.qb_transactions(company_id);
CREATE INDEX idx_qb_transactions_type ON public.qb_transactions(entity_type);
CREATE INDEX idx_qb_transactions_date ON public.qb_transactions(txn_date);
CREATE INDEX idx_qb_transactions_customer ON public.qb_transactions(customer_qb_id);
CREATE INDEX idx_qb_transactions_vendor ON public.qb_transactions(vendor_qb_id);
CREATE INDEX idx_gl_transactions_company ON public.gl_transactions(company_id);
CREATE INDEX idx_gl_transactions_date ON public.gl_transactions(txn_date);
CREATE INDEX idx_gl_transactions_qb ON public.gl_transactions(qb_transaction_id);
CREATE INDEX idx_gl_lines_txn ON public.gl_lines(gl_transaction_id);
CREATE INDEX idx_gl_lines_account ON public.gl_lines(account_id);
CREATE INDEX idx_qb_sync_logs_company ON public.qb_sync_logs(company_id);
CREATE INDEX idx_qb_sync_logs_created ON public.qb_sync_logs(created_at);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

CREATE TRIGGER update_qb_company_info_updated_at BEFORE UPDATE ON public.qb_company_info FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_qb_accounts_updated_at BEFORE UPDATE ON public.qb_accounts FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_qb_customers_updated_at BEFORE UPDATE ON public.qb_customers FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_qb_vendors_updated_at BEFORE UPDATE ON public.qb_vendors FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_qb_items_updated_at BEFORE UPDATE ON public.qb_items FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_qb_transactions_updated_at BEFORE UPDATE ON public.qb_transactions FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- RLS POLICIES
-- ============================================================

ALTER TABLE public.qb_company_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qb_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qb_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qb_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qb_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qb_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gl_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gl_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qb_sync_logs ENABLE ROW LEVEL SECURITY;

-- SELECT: admin + accounting roles, scoped by company_id
CREATE POLICY "Admin/accounting can read qb_company_info" ON public.qb_company_info FOR SELECT USING (
  company_id = public.get_user_company_id(auth.uid()) AND public.has_any_role(auth.uid(), ARRAY['admin','accounting']::app_role[])
);
CREATE POLICY "Admin/accounting can read qb_accounts" ON public.qb_accounts FOR SELECT USING (
  company_id = public.get_user_company_id(auth.uid()) AND public.has_any_role(auth.uid(), ARRAY['admin','accounting']::app_role[])
);
CREATE POLICY "Admin/accounting can read qb_customers" ON public.qb_customers FOR SELECT USING (
  company_id = public.get_user_company_id(auth.uid()) AND public.has_any_role(auth.uid(), ARRAY['admin','accounting']::app_role[])
);
CREATE POLICY "Admin/accounting can read qb_vendors" ON public.qb_vendors FOR SELECT USING (
  company_id = public.get_user_company_id(auth.uid()) AND public.has_any_role(auth.uid(), ARRAY['admin','accounting']::app_role[])
);
CREATE POLICY "Admin/accounting can read qb_items" ON public.qb_items FOR SELECT USING (
  company_id = public.get_user_company_id(auth.uid()) AND public.has_any_role(auth.uid(), ARRAY['admin','accounting']::app_role[])
);
CREATE POLICY "Admin/accounting can read qb_transactions" ON public.qb_transactions FOR SELECT USING (
  company_id = public.get_user_company_id(auth.uid()) AND public.has_any_role(auth.uid(), ARRAY['admin','accounting']::app_role[])
);
CREATE POLICY "Admin/accounting can read gl_transactions" ON public.gl_transactions FOR SELECT USING (
  company_id = public.get_user_company_id(auth.uid()) AND public.has_any_role(auth.uid(), ARRAY['admin','accounting']::app_role[])
);
CREATE POLICY "Admin/accounting can read gl_lines" ON public.gl_lines FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.gl_transactions gt
    WHERE gt.id = gl_lines.gl_transaction_id
      AND gt.company_id = public.get_user_company_id(auth.uid())
  ) AND public.has_any_role(auth.uid(), ARRAY['admin','accounting']::app_role[])
);
CREATE POLICY "Admin/accounting can read qb_sync_logs" ON public.qb_sync_logs FOR SELECT USING (
  company_id = public.get_user_company_id(auth.uid()) AND public.has_any_role(auth.uid(), ARRAY['admin','accounting']::app_role[])
);

-- Service role handles all writes (edge functions use service_role key)
-- No INSERT/UPDATE/DELETE policies needed for authenticated users - sync engine uses service role
