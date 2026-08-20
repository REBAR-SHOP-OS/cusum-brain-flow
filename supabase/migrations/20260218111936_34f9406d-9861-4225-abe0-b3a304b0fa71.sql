
-- Expense Claims table
CREATE TABLE public.expense_claims (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  profile_id UUID NOT NULL REFERENCES public.profiles(id),
  claim_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  total_amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'AUD',
  submitted_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  paid_at TIMESTAMPTZ,
  payment_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Expense Claim Items (line items / receipts)
CREATE TABLE public.expense_claim_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  claim_id UUID NOT NULL REFERENCES public.expense_claims(id) ON DELETE CASCADE,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT NOT NULL DEFAULT 'other',
  description TEXT NOT NULL DEFAULT '',
  amount NUMERIC NOT NULL DEFAULT 0,
  receipt_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.expense_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_claim_items ENABLE ROW LEVEL SECURITY;

-- Validation trigger for expense_claims status
CREATE OR REPLACE FUNCTION public.validate_expense_claim_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status NOT IN ('draft', 'submitted', 'approved', 'rejected', 'paid') THEN
    RAISE EXCEPTION 'Invalid expense_claim status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_expense_claim
BEFORE INSERT OR UPDATE ON public.expense_claims
FOR EACH ROW EXECUTE FUNCTION public.validate_expense_claim_fields();

-- Auto-recalculate total on item changes
CREATE OR REPLACE FUNCTION public.recalc_expense_claim_total()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _claim_id UUID;
  _total NUMERIC;
BEGIN
  _claim_id := COALESCE(NEW.claim_id, OLD.claim_id);
  SELECT COALESCE(SUM(amount), 0) INTO _total
    FROM public.expense_claim_items
    WHERE claim_id = _claim_id;
  UPDATE public.expense_claims SET total_amount = _total, updated_at = now() WHERE id = _claim_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_recalc_expense_total
AFTER INSERT OR UPDATE OR DELETE ON public.expense_claim_items
FOR EACH ROW EXECUTE FUNCTION public.recalc_expense_claim_total();

-- Updated_at trigger
CREATE TRIGGER update_expense_claims_updated_at
BEFORE UPDATE ON public.expense_claims
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies for expense_claims
-- Users can see their own claims
CREATE POLICY "Users see own expense claims"
ON public.expense_claims FOR SELECT TO authenticated
USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Admins/accounting can see all claims in their company
CREATE POLICY "Admins see all expense claims"
ON public.expense_claims FOR SELECT TO authenticated
USING (
  company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accounting'))
);

-- Users can insert their own claims
CREATE POLICY "Users insert own expense claims"
ON public.expense_claims FOR INSERT TO authenticated
WITH CHECK (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Users can update their own draft claims; admins/accounting can update any
CREATE POLICY "Users update own draft claims"
ON public.expense_claims FOR UPDATE TO authenticated
USING (
  (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) AND status = 'draft')
  OR (
    company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accounting'))
  )
);

-- Users can delete own draft claims
CREATE POLICY "Users delete own draft claims"
ON public.expense_claims FOR DELETE TO authenticated
USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) AND status = 'draft');

-- RLS Policies for expense_claim_items
CREATE POLICY "Users see own claim items"
ON public.expense_claim_items FOR SELECT TO authenticated
USING (claim_id IN (
  SELECT id FROM public.expense_claims WHERE profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
));

CREATE POLICY "Admins see all claim items"
ON public.expense_claim_items FOR SELECT TO authenticated
USING (claim_id IN (
  SELECT ec.id FROM public.expense_claims ec
  WHERE ec.company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accounting'))
));

CREATE POLICY "Users insert own claim items"
ON public.expense_claim_items FOR INSERT TO authenticated
WITH CHECK (claim_id IN (
  SELECT id FROM public.expense_claims WHERE profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) AND status = 'draft'
));

CREATE POLICY "Users update own draft claim items"
ON public.expense_claim_items FOR UPDATE TO authenticated
USING (claim_id IN (
  SELECT id FROM public.expense_claims WHERE profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) AND status = 'draft'
));

CREATE POLICY "Users delete own draft claim items"
ON public.expense_claim_items FOR DELETE TO authenticated
USING (claim_id IN (
  SELECT id FROM public.expense_claims WHERE profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) AND status = 'draft'
));

-- Generate claim numbers
CREATE OR REPLACE FUNCTION public.generate_expense_claim_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _seq INT;
BEGIN
  SELECT COUNT(*) + 1 INTO _seq FROM public.expense_claims WHERE company_id = NEW.company_id;
  NEW.claim_number := 'EXP-' || LPAD(_seq::text, 5, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_expense_claim_number
BEFORE INSERT ON public.expense_claims
FOR EACH ROW EXECUTE FUNCTION public.generate_expense_claim_number();
