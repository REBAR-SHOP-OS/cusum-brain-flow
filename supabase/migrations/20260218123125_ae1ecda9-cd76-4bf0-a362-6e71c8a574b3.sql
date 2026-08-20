
-- Tax Planning Profiles
CREATE TABLE public.tax_planning_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  fiscal_year INTEGER NOT NULL DEFAULT extract(year FROM now())::integer,
  owner_pay_strategy TEXT NOT NULL DEFAULT 'dividend_first',
  hsa_annual_limit NUMERIC NOT NULL DEFAULT 0,
  hsa_claimed_ytd NUMERIC NOT NULL DEFAULT 0,
  target_retained_earnings NUMERIC NOT NULL DEFAULT 0,
  max_withdrawal_pct NUMERIC NOT NULL DEFAULT 100,
  sbr_rate NUMERIC NOT NULL DEFAULT 12.2,
  personal_bracket_estimate NUMERIC NOT NULL DEFAULT 30,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, fiscal_year)
);

ALTER TABLE public.tax_planning_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tax_planning_profiles_select" ON public.tax_planning_profiles
  FOR SELECT USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "tax_planning_profiles_insert" ON public.tax_planning_profiles
  FOR INSERT WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "tax_planning_profiles_update" ON public.tax_planning_profiles
  FOR UPDATE USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "tax_planning_profiles_delete" ON public.tax_planning_profiles
  FOR DELETE USING (company_id = public.get_user_company_id(auth.uid()));

-- Validation trigger for owner_pay_strategy
CREATE OR REPLACE FUNCTION public.validate_tax_planning_profile_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.owner_pay_strategy NOT IN ('salary_first', 'dividend_first', 'blended') THEN
    RAISE EXCEPTION 'Invalid owner_pay_strategy: %', NEW.owner_pay_strategy;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_tax_planning_profile
  BEFORE INSERT OR UPDATE ON public.tax_planning_profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_tax_planning_profile_fields();

-- Tax Planning Tasks
CREATE TABLE public.tax_planning_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  fiscal_year INTEGER NOT NULL DEFAULT extract(year FROM now())::integer,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'year-end',
  status TEXT NOT NULL DEFAULT 'todo',
  due_date DATE,
  assigned_to TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tax_planning_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tax_planning_tasks_select" ON public.tax_planning_tasks
  FOR SELECT USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "tax_planning_tasks_insert" ON public.tax_planning_tasks
  FOR INSERT WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "tax_planning_tasks_update" ON public.tax_planning_tasks
  FOR UPDATE USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "tax_planning_tasks_delete" ON public.tax_planning_tasks
  FOR DELETE USING (company_id = public.get_user_company_id(auth.uid()));

CREATE OR REPLACE FUNCTION public.validate_tax_planning_task_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.category NOT IN ('owner-pay', 'expenses', 'hsa', 'cca', 'gst-hst', 'year-end') THEN
    RAISE EXCEPTION 'Invalid tax task category: %', NEW.category;
  END IF;
  IF NEW.status NOT IN ('todo', 'in_progress', 'done') THEN
    RAISE EXCEPTION 'Invalid tax task status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_tax_planning_task
  BEFORE INSERT OR UPDATE ON public.tax_planning_tasks
  FOR EACH ROW EXECUTE FUNCTION public.validate_tax_planning_task_fields();

-- Tax Deduction Tracker
CREATE TABLE public.tax_deduction_tracker (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  fiscal_year INTEGER NOT NULL DEFAULT extract(year FROM now())::integer,
  category TEXT NOT NULL DEFAULT 'other',
  description TEXT NOT NULL DEFAULT '',
  estimated_amount NUMERIC NOT NULL DEFAULT 0,
  claimed_amount NUMERIC NOT NULL DEFAULT 0,
  is_claimed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tax_deduction_tracker ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tax_deduction_tracker_select" ON public.tax_deduction_tracker
  FOR SELECT USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "tax_deduction_tracker_insert" ON public.tax_deduction_tracker
  FOR INSERT WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "tax_deduction_tracker_update" ON public.tax_deduction_tracker
  FOR UPDATE USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "tax_deduction_tracker_delete" ON public.tax_deduction_tracker
  FOR DELETE USING (company_id = public.get_user_company_id(auth.uid()));

CREATE OR REPLACE FUNCTION public.validate_tax_deduction_category()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.category NOT IN ('home-office', 'phone', 'software', 'professional', 'banking', 'insurance', 'education', 'other') THEN
    RAISE EXCEPTION 'Invalid deduction category: %', NEW.category;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_tax_deduction
  BEFORE INSERT OR UPDATE ON public.tax_deduction_tracker
  FOR EACH ROW EXECUTE FUNCTION public.validate_tax_deduction_category();

-- CCA Schedule Items
CREATE TABLE public.cca_schedule_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  fiscal_year INTEGER NOT NULL DEFAULT extract(year FROM now())::integer,
  asset_description TEXT NOT NULL DEFAULT '',
  cca_class INTEGER NOT NULL DEFAULT 10,
  ucc_opening NUMERIC NOT NULL DEFAULT 0,
  additions NUMERIC NOT NULL DEFAULT 0,
  dispositions NUMERIC NOT NULL DEFAULT 0,
  cca_rate NUMERIC NOT NULL DEFAULT 30,
  cca_claimed NUMERIC NOT NULL DEFAULT 0,
  ucc_closing NUMERIC NOT NULL DEFAULT 0,
  use_this_year BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cca_schedule_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cca_schedule_items_select" ON public.cca_schedule_items
  FOR SELECT USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "cca_schedule_items_insert" ON public.cca_schedule_items
  FOR INSERT WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "cca_schedule_items_update" ON public.cca_schedule_items
  FOR UPDATE USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "cca_schedule_items_delete" ON public.cca_schedule_items
  FOR DELETE USING (company_id = public.get_user_company_id(auth.uid()));
