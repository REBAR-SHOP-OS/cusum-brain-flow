
-- ═══════════════════════════════════════════════════════════
-- 1) autopilot_protected_models — registry of protected Odoo models
-- ═══════════════════════════════════════════════════════════
CREATE TABLE public.autopilot_protected_models (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  model TEXT NOT NULL UNIQUE,
  risk_level TEXT NOT NULL DEFAULT 'critical',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.autopilot_protected_models ENABLE ROW LEVEL SECURITY;

-- Admin read-only (service_role manages inserts)
CREATE POLICY "Admins can read protected models"
  ON public.autopilot_protected_models FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Validation trigger
CREATE OR REPLACE FUNCTION public.validate_protected_model_risk()
  RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.risk_level NOT IN ('low', 'medium', 'high', 'critical') THEN
    RAISE EXCEPTION 'Invalid risk_level: %', NEW.risk_level;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_protected_model_risk
  BEFORE INSERT OR UPDATE ON public.autopilot_protected_models
  FOR EACH ROW EXECUTE FUNCTION public.validate_protected_model_risk();

-- Seed data
INSERT INTO public.autopilot_protected_models (model, risk_level, notes) VALUES
  ('account.move', 'critical', 'Accounting entries'),
  ('account.payment', 'critical', 'Payment records'),
  ('account.bank.statement', 'critical', 'Bank statements'),
  ('hr.payslip', 'critical', 'Payroll data'),
  ('hr.employee', 'high', 'Employee records'),
  ('res.users', 'critical', 'User accounts'),
  ('res.partner', 'high', 'Partner/contact records'),
  ('stock.quant', 'high', 'Inventory quantities'),
  ('product.template', 'high', 'Product templates'),
  ('ir.config_parameter', 'critical', 'System configuration'),
  ('ir.rule', 'critical', 'Access rules'),
  ('ir.model.access', 'critical', 'Model access control');

-- ═══════════════════════════════════════════════════════════
-- 2) autopilot_risk_policies — table-driven risk rules
-- ═══════════════════════════════════════════════════════════
CREATE TABLE public.autopilot_risk_policies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tool_name TEXT NOT NULL,
  model TEXT,
  field TEXT,
  risk_level TEXT NOT NULL,
  notes TEXT,
  company_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.autopilot_risk_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read risk policies"
  ON public.autopilot_risk_policies FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage risk policies"
  ON public.autopilot_risk_policies FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.validate_risk_policy_fields()
  RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.risk_level NOT IN ('low', 'medium', 'high', 'critical') THEN
    RAISE EXCEPTION 'Invalid risk_level: %', NEW.risk_level;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_risk_policy
  BEFORE INSERT OR UPDATE ON public.autopilot_risk_policies
  FOR EACH ROW EXECUTE FUNCTION public.validate_risk_policy_fields();

CREATE TRIGGER update_risk_policies_updated_at
  BEFORE UPDATE ON public.autopilot_risk_policies
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Seed risk policies
INSERT INTO public.autopilot_risk_policies (tool_name, model, field, risk_level, notes) VALUES
  ('odoo_write', 'account.move', NULL, 'critical', 'All writes to accounting entries'),
  ('odoo_write', 'account.payment', NULL, 'critical', 'All writes to payments'),
  ('odoo_write', 'hr.payslip', NULL, 'critical', 'Payroll modifications'),
  ('odoo_write', 'hr.employee', NULL, 'high', 'Employee record modifications'),
  ('odoo_write', 'res.users', NULL, 'critical', 'User account modifications'),
  ('odoo_write', 'ir.config_parameter', NULL, 'critical', 'System config changes'),
  ('odoo_write', 'ir.rule', NULL, 'critical', 'Access rule changes'),
  ('odoo_write', 'ir.model.access', NULL, 'critical', 'ACL changes'),
  ('odoo_write', NULL, 'state', 'high', 'State field changes on any model'),
  ('odoo_write', NULL, 'stage_id', 'high', 'Stage changes on any model'),
  ('generate_patch', NULL, NULL, 'high', 'Code patch generation'),
  ('validate_code', NULL, NULL, 'low', 'Code validation is read-only');

-- ═══════════════════════════════════════════════════════════
-- 3) Add lock columns to autopilot_runs
-- ═══════════════════════════════════════════════════════════
ALTER TABLE public.autopilot_runs
  ADD COLUMN IF NOT EXISTS execution_lock_uuid UUID,
  ADD COLUMN IF NOT EXISTS execution_started_at TIMESTAMPTZ;
