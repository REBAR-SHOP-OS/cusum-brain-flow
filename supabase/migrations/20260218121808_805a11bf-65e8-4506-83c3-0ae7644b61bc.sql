
-- ============================================
-- 1. RECONCILIATION MATCHES TABLE
-- ============================================
CREATE TABLE public.reconciliation_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  bank_account_id TEXT NOT NULL,
  bank_txn_date DATE NOT NULL,
  bank_txn_amount NUMERIC NOT NULL,
  bank_txn_description TEXT,
  matched_entity_type TEXT, -- 'Invoice', 'Bill', 'Payment', 'BillPayment', 'Deposit'
  matched_entity_id TEXT,   -- quickbooks_id
  matched_mirror_id UUID REFERENCES public.accounting_mirror(id),
  confidence NUMERIC NOT NULL DEFAULT 0, -- 0-100
  match_reason TEXT,        -- why this was matched
  status TEXT NOT NULL DEFAULT 'pending', -- pending, auto_matched, approved, rejected
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reconciliation_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view reconciliation matches"
  ON public.reconciliation_matches FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Company members can manage reconciliation matches"
  ON public.reconciliation_matches FOR ALL
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

-- Validation trigger
CREATE OR REPLACE FUNCTION public.validate_reconciliation_match_fields()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'auto_matched', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid reconciliation_match status: %', NEW.status;
  END IF;
  IF NEW.confidence < 0 OR NEW.confidence > 100 THEN
    RAISE EXCEPTION 'Confidence must be between 0 and 100';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_validate_reconciliation_match
  BEFORE INSERT OR UPDATE ON public.reconciliation_matches
  FOR EACH ROW EXECUTE FUNCTION public.validate_reconciliation_match_fields();

-- ============================================
-- 2. RECURRING TRANSACTIONS TABLE
-- ============================================
CREATE TABLE public.recurring_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  name TEXT NOT NULL,
  transaction_type TEXT NOT NULL, -- 'Invoice', 'Bill', 'SalesReceipt'
  template_data JSONB NOT NULL DEFAULT '{}',
  customer_id UUID REFERENCES public.customers(id),
  frequency TEXT NOT NULL DEFAULT 'monthly', -- daily, weekly, biweekly, monthly, quarterly, yearly
  next_run_at TIMESTAMPTZ NOT NULL,
  last_run_at TIMESTAMPTZ,
  auto_post BOOLEAN NOT NULL DEFAULT false,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.recurring_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view recurring transactions"
  ON public.recurring_transactions FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Company members can manage recurring transactions"
  ON public.recurring_transactions FOR ALL
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.validate_recurring_transaction_fields()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.transaction_type NOT IN ('Invoice', 'Bill', 'SalesReceipt') THEN
    RAISE EXCEPTION 'Invalid transaction_type: %', NEW.transaction_type;
  END IF;
  IF NEW.frequency NOT IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly') THEN
    RAISE EXCEPTION 'Invalid frequency: %', NEW.frequency;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_validate_recurring_transaction
  BEFORE INSERT OR UPDATE ON public.recurring_transactions
  FOR EACH ROW EXECUTE FUNCTION public.validate_recurring_transaction_fields();

-- ============================================
-- 3. SCHEDULED REPORTS TABLE
-- ============================================
CREATE TABLE public.scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  name TEXT NOT NULL,
  report_type TEXT NOT NULL, -- 'pl', 'ar_aging', 'cash_flow', 'balance_sheet', 'trial_balance'
  frequency TEXT NOT NULL DEFAULT 'weekly', -- daily, weekly, monthly
  recipients TEXT[] NOT NULL DEFAULT '{}',
  next_run_at TIMESTAMPTZ NOT NULL,
  last_run_at TIMESTAMPTZ,
  last_report_url TEXT,
  config JSONB NOT NULL DEFAULT '{}', -- date range params, filters
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.scheduled_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view scheduled reports"
  ON public.scheduled_reports FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Company members can manage scheduled reports"
  ON public.scheduled_reports FOR ALL
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.validate_scheduled_report_fields()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.report_type NOT IN ('pl', 'ar_aging', 'cash_flow', 'balance_sheet', 'trial_balance') THEN
    RAISE EXCEPTION 'Invalid report_type: %', NEW.report_type;
  END IF;
  IF NEW.frequency NOT IN ('daily', 'weekly', 'monthly') THEN
    RAISE EXCEPTION 'Invalid scheduled_report frequency: %', NEW.frequency;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_validate_scheduled_report
  BEFORE INSERT OR UPDATE ON public.scheduled_reports
  FOR EACH ROW EXECUTE FUNCTION public.validate_scheduled_report_fields();
