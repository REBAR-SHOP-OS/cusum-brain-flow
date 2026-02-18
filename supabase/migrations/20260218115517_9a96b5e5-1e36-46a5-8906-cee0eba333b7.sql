
-- Lead Scoring: Rules-based scoring engine

CREATE TABLE public.lead_scoring_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  name TEXT NOT NULL,
  field_name TEXT NOT NULL,
  operator TEXT NOT NULL DEFAULT 'equals',
  field_value TEXT NOT NULL,
  score_points INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add computed score to leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS computed_score INTEGER DEFAULT 0;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS score_updated_at TIMESTAMPTZ;

-- Validation
CREATE OR REPLACE FUNCTION public.validate_scoring_rule_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.operator NOT IN ('equals', 'not_equals', 'contains', 'greater_than', 'less_than', 'is_set', 'is_not_set') THEN
    RAISE EXCEPTION 'Invalid scoring rule operator: %', NEW.operator;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER validate_scoring_rule BEFORE INSERT OR UPDATE ON public.lead_scoring_rules
FOR EACH ROW EXECUTE FUNCTION public.validate_scoring_rule_fields();

CREATE TRIGGER update_lead_scoring_rules_updated_at BEFORE UPDATE ON public.lead_scoring_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.lead_scoring_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manages scoring rules" ON public.lead_scoring_rules FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Sales views scoring rules" ON public.lead_scoring_rules FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'sales'::app_role) OR public.has_role(auth.uid(), 'office'::app_role));
