
-- ============================================================
-- Phase 1: Pipeline Memory Engine — Schema
-- ============================================================

-- 1) Lead Qualification Memory (1:1 with leads)
CREATE TABLE public.lead_qualification_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL UNIQUE REFERENCES public.leads(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  project_type TEXT NOT NULL,
  estimated_tonnage NUMERIC(10,2) NOT NULL,
  deadline DATE NOT NULL,
  decision_maker_identified BOOLEAN NOT NULL,
  budget_known BOOLEAN NOT NULL,
  repeat_customer BOOLEAN NOT NULL,
  competitors_involved BOOLEAN NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  captured_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_qualification_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company qualification memory"
  ON public.lead_qualification_memory FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert own company qualification memory"
  ON public.lead_qualification_memory FOR INSERT
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can update own company qualification memory"
  ON public.lead_qualification_memory FOR UPDATE
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE INDEX idx_lqm_lead_id ON lead_qualification_memory(lead_id);
CREATE INDEX idx_lqm_project_type ON lead_qualification_memory(project_type);
CREATE INDEX idx_lqm_deadline ON lead_qualification_memory(deadline);
CREATE INDEX idx_lqm_company_id ON lead_qualification_memory(company_id);

-- Validation trigger for enums
CREATE OR REPLACE FUNCTION public.validate_qualification_memory()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.project_type NOT IN ('Residential', 'Commercial', 'Infrastructure', 'Industrial') THEN
    RAISE EXCEPTION 'Invalid project_type: %. Must be Residential, Commercial, Infrastructure, or Industrial.', NEW.project_type;
  END IF;
  IF NEW.estimated_tonnage <= 0 THEN
    RAISE EXCEPTION 'estimated_tonnage must be > 0';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_qualification_memory
  BEFORE INSERT OR UPDATE ON public.lead_qualification_memory
  FOR EACH ROW EXECUTE FUNCTION public.validate_qualification_memory();

-- 2) Lead Quote Memory (1:N with leads — revision history)
CREATE TABLE public.lead_quote_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  revision_number INTEGER NOT NULL DEFAULT 1,
  quoted_price NUMERIC(14,2) NOT NULL,
  target_margin_pct NUMERIC(5,2) NOT NULL,
  material_cost_snapshot NUMERIC(14,2) NOT NULL,
  strategic_priority TEXT NOT NULL,
  submission_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_by UUID,
  is_current BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_quote_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company quote memory"
  ON public.lead_quote_memory FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert own company quote memory"
  ON public.lead_quote_memory FOR INSERT
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can update own company quote memory"
  ON public.lead_quote_memory FOR UPDATE
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE INDEX idx_lpm_lead_id ON lead_quote_memory(lead_id);
CREATE INDEX idx_lpm_is_current ON lead_quote_memory(lead_id, is_current);
CREATE INDEX idx_lpm_submitted_at ON lead_quote_memory(submission_time);
CREATE INDEX idx_lpm_strategic_priority ON lead_quote_memory(strategic_priority);

CREATE OR REPLACE FUNCTION public.validate_quote_memory()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.quoted_price <= 0 THEN
    RAISE EXCEPTION 'quoted_price must be > 0';
  END IF;
  IF NEW.target_margin_pct < -100 OR NEW.target_margin_pct > 100 THEN
    RAISE EXCEPTION 'target_margin_pct must be between -100 and 100';
  END IF;
  IF NEW.strategic_priority NOT IN ('Low', 'Medium', 'High') THEN
    RAISE EXCEPTION 'Invalid strategic_priority: %. Must be Low, Medium, or High.', NEW.strategic_priority;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_quote_memory
  BEFORE INSERT OR UPDATE ON public.lead_quote_memory
  FOR EACH ROW EXECUTE FUNCTION public.validate_quote_memory();

-- Auto-set previous revisions to is_current = false
CREATE OR REPLACE FUNCTION public.deactivate_old_quote_revisions()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.is_current = true THEN
    UPDATE public.lead_quote_memory
      SET is_current = false, updated_at = now()
      WHERE lead_id = NEW.lead_id AND id != NEW.id AND is_current = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_deactivate_old_quote_revisions
  AFTER INSERT ON public.lead_quote_memory
  FOR EACH ROW EXECUTE FUNCTION public.deactivate_old_quote_revisions();

-- Auto-increment revision_number
CREATE OR REPLACE FUNCTION public.auto_increment_quote_revision()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE
  _max_rev INTEGER;
BEGIN
  SELECT COALESCE(MAX(revision_number), 0) INTO _max_rev
    FROM public.lead_quote_memory WHERE lead_id = NEW.lead_id;
  NEW.revision_number := _max_rev + 1;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_increment_quote_revision
  BEFORE INSERT ON public.lead_quote_memory
  FOR EACH ROW EXECUTE FUNCTION public.auto_increment_quote_revision();

-- 3) Lead Loss Memory (1:1 with leads)
CREATE TABLE public.lead_loss_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL UNIQUE REFERENCES public.leads(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  loss_reason TEXT NOT NULL,
  competitor_name TEXT,
  winning_price_known BOOLEAN NOT NULL DEFAULT false,
  winning_price NUMERIC(14,2),
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  captured_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_loss_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company loss memory"
  ON public.lead_loss_memory FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert own company loss memory"
  ON public.lead_loss_memory FOR INSERT
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can update own company loss memory"
  ON public.lead_loss_memory FOR UPDATE
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE INDEX idx_llm_loss_reason ON lead_loss_memory(loss_reason);
CREATE INDEX idx_llm_competitor ON lead_loss_memory(competitor_name);
CREATE INDEX idx_llm_company_id ON lead_loss_memory(company_id);

CREATE OR REPLACE FUNCTION public.validate_loss_memory()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.loss_reason NOT IN ('Price Too High', 'Lost to Competitor', 'Budget Cut', 'Timing Issue', 'Scope Change', 'Other') THEN
    RAISE EXCEPTION 'Invalid loss_reason: %', NEW.loss_reason;
  END IF;
  IF NEW.loss_reason = 'Lost to Competitor' AND (NEW.competitor_name IS NULL OR NEW.competitor_name = '') THEN
    RAISE EXCEPTION 'competitor_name is required when loss_reason = Lost to Competitor';
  END IF;
  IF NEW.winning_price_known = true AND NEW.winning_price IS NULL THEN
    RAISE EXCEPTION 'winning_price is required when winning_price_known = true';
  END IF;
  IF NEW.winning_price IS NOT NULL AND NEW.winning_price <= 0 THEN
    RAISE EXCEPTION 'winning_price must be > 0';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_loss_memory
  BEFORE INSERT OR UPDATE ON public.lead_loss_memory
  FOR EACH ROW EXECUTE FUNCTION public.validate_loss_memory();

-- 4) Lead Outcome Memory (1:1 — delivery performance)
CREATE TABLE public.lead_outcome_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL UNIQUE REFERENCES public.leads(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  customer_id UUID REFERENCES public.customers(id),
  final_revenue NUMERIC(14,2) NOT NULL,
  final_cost NUMERIC(14,2) NOT NULL,
  actual_margin_pct NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN final_revenue > 0
    THEN ROUND(((final_revenue - final_cost) / final_revenue) * 100, 2)
    ELSE 0 END
  ) STORED,
  delay_occurred BOOLEAN NOT NULL,
  client_satisfaction INTEGER NOT NULL,
  reorder_probability TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  captured_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_outcome_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company outcome memory"
  ON public.lead_outcome_memory FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert own company outcome memory"
  ON public.lead_outcome_memory FOR INSERT
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can update own company outcome memory"
  ON public.lead_outcome_memory FOR UPDATE
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE INDEX idx_lom_customer_id ON lead_outcome_memory(customer_id);
CREATE INDEX idx_lom_satisfaction ON lead_outcome_memory(client_satisfaction);
CREATE INDEX idx_lom_margin ON lead_outcome_memory(actual_margin_pct);
CREATE INDEX idx_lom_company_id ON lead_outcome_memory(company_id);

CREATE OR REPLACE FUNCTION public.validate_outcome_memory()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.final_revenue < 0 THEN
    RAISE EXCEPTION 'final_revenue must be >= 0';
  END IF;
  IF NEW.final_cost < 0 THEN
    RAISE EXCEPTION 'final_cost must be >= 0';
  END IF;
  IF NEW.client_satisfaction < 1 OR NEW.client_satisfaction > 5 THEN
    RAISE EXCEPTION 'client_satisfaction must be between 1 and 5';
  END IF;
  IF NEW.reorder_probability NOT IN ('Low', 'Medium', 'High') THEN
    RAISE EXCEPTION 'Invalid reorder_probability: %. Must be Low, Medium, or High.', NEW.reorder_probability;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_outcome_memory
  BEFORE INSERT OR UPDATE ON public.lead_outcome_memory
  FOR EACH ROW EXECUTE FUNCTION public.validate_outcome_memory();

-- 5) Client Performance Memory (aggregated per customer)
CREATE TABLE public.client_performance_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL UNIQUE REFERENCES public.customers(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  total_won_leads INTEGER NOT NULL DEFAULT 0,
  total_lost_leads INTEGER NOT NULL DEFAULT 0,
  total_revenue NUMERIC(14,2) NOT NULL DEFAULT 0,
  avg_margin_pct NUMERIC(5,2),
  avg_satisfaction NUMERIC(3,2),
  avg_delay_rate NUMERIC(5,2),
  win_rate_pct NUMERIC(5,2),
  reorder_rate_pct NUMERIC(5,2),
  client_lifetime_score NUMERIC(5,1),
  last_recalculated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.client_performance_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company client performance"
  ON public.client_performance_memory FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert own company client performance"
  ON public.client_performance_memory FOR INSERT
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can update own company client performance"
  ON public.client_performance_memory FOR UPDATE
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE INDEX idx_cpm_customer_id ON client_performance_memory(customer_id);
CREATE INDEX idx_cpm_lifetime_score ON client_performance_memory(client_lifetime_score DESC);

-- 6) Pipeline Transition Log (audit + sync failures)
CREATE TABLE public.pipeline_transition_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id),
  company_id UUID NOT NULL,
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  transition_result TEXT NOT NULL,
  block_reason_code TEXT,
  block_reason_detail JSONB,
  triggered_by TEXT NOT NULL,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pipeline_transition_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company transition logs"
  ON public.pipeline_transition_log FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert own company transition logs"
  ON public.pipeline_transition_log FOR INSERT
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE INDEX idx_ptl_lead_id ON pipeline_transition_log(lead_id);
CREATE INDEX idx_ptl_result ON pipeline_transition_log(transition_result);
CREATE INDEX idx_ptl_created ON pipeline_transition_log(created_at DESC);

CREATE OR REPLACE FUNCTION public.validate_transition_log()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.transition_result NOT IN ('allowed', 'blocked', 'odoo_sync') THEN
    RAISE EXCEPTION 'Invalid transition_result: %', NEW.transition_result;
  END IF;
  IF NEW.triggered_by NOT IN ('ui', 'api', 'odoo_sync') THEN
    RAISE EXCEPTION 'Invalid triggered_by: %', NEW.triggered_by;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_transition_log
  BEFORE INSERT OR UPDATE ON public.pipeline_transition_log
  FOR EACH ROW EXECUTE FUNCTION public.validate_transition_log();

-- 7) Add scoring columns to leads table
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS win_prob_score NUMERIC(5,1),
  ADD COLUMN IF NOT EXISTS priority_score NUMERIC(5,1),
  ADD COLUMN IF NOT EXISTS expected_value NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS score_confidence TEXT DEFAULT 'low';
