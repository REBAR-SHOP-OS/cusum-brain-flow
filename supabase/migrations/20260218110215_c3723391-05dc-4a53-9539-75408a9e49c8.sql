
-- Budget management: set budgets per account/department, track actuals vs budget
CREATE TABLE public.budgets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  name TEXT NOT NULL,
  fiscal_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM now())::integer,
  period_type TEXT NOT NULL DEFAULT 'monthly', -- monthly, quarterly, annual
  account_category TEXT, -- e.g. 'revenue', 'expense', 'cogs'
  department TEXT, -- optional department tag
  jan NUMERIC NOT NULL DEFAULT 0,
  feb NUMERIC NOT NULL DEFAULT 0,
  mar NUMERIC NOT NULL DEFAULT 0,
  apr NUMERIC NOT NULL DEFAULT 0,
  may NUMERIC NOT NULL DEFAULT 0,
  jun NUMERIC NOT NULL DEFAULT 0,
  jul NUMERIC NOT NULL DEFAULT 0,
  aug NUMERIC NOT NULL DEFAULT 0,
  sep NUMERIC NOT NULL DEFAULT 0,
  oct NUMERIC NOT NULL DEFAULT 0,
  nov NUMERIC NOT NULL DEFAULT 0,
  "dec" NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

-- RLS policies using company_id pattern
CREATE POLICY "budgets_select" ON public.budgets FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "budgets_insert" ON public.budgets FOR INSERT
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "budgets_update" ON public.budgets FOR UPDATE
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "budgets_delete" ON public.budgets FOR DELETE
  USING (company_id = public.get_user_company_id(auth.uid()));

-- Indexes
CREATE INDEX idx_budgets_company_year ON public.budgets (company_id, fiscal_year);

-- Trigger for updated_at
CREATE TRIGGER update_budgets_updated_at
  BEFORE UPDATE ON public.budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Validation trigger
CREATE OR REPLACE FUNCTION public.validate_budget_fields()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.period_type NOT IN ('monthly', 'quarterly', 'annual') THEN
    RAISE EXCEPTION 'Invalid budget period_type: %', NEW.period_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_budget_fields_trigger
  BEFORE INSERT OR UPDATE ON public.budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_budget_fields();

-- Attach field audit trail
CREATE TRIGGER track_budgets_field_changes
  AFTER UPDATE ON public.budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.track_field_changes();
