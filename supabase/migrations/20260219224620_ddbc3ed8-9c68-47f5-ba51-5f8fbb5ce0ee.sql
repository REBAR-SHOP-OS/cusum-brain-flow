
-- Pipeline automation rules table
CREATE TABLE public.pipeline_automation_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  trigger_event TEXT NOT NULL, -- stage_change, sla_breach, stale_lead, value_change, new_lead
  trigger_conditions JSONB NOT NULL DEFAULT '{}', -- e.g. {"from_stage": "new", "to_stage": "qualified"}
  action_type TEXT NOT NULL, -- auto_assign, auto_notify, auto_move_stage, auto_escalate, auto_tag
  action_params JSONB NOT NULL DEFAULT '{}', -- e.g. {"assign_to": "Sales Mgr", "notify_roles": ["admin"]}
  priority INTEGER NOT NULL DEFAULT 100,
  execution_count INTEGER NOT NULL DEFAULT 0,
  last_executed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pipeline_automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view automation rules for their company"
ON public.pipeline_automation_rules FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Admins can manage automation rules"
ON public.pipeline_automation_rules FOR ALL TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (company_id = public.get_user_company_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- Validation trigger
CREATE OR REPLACE FUNCTION public.validate_pipeline_automation_rule()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.trigger_event NOT IN ('stage_change', 'sla_breach', 'stale_lead', 'value_change', 'new_lead') THEN
    RAISE EXCEPTION 'Invalid trigger_event: %', NEW.trigger_event;
  END IF;
  IF NEW.action_type NOT IN ('auto_assign', 'auto_notify', 'auto_move_stage', 'auto_escalate', 'auto_tag') THEN
    RAISE EXCEPTION 'Invalid action_type: %', NEW.action_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_pipeline_automation_rule_trigger
BEFORE INSERT OR UPDATE ON public.pipeline_automation_rules
FOR EACH ROW EXECUTE FUNCTION public.validate_pipeline_automation_rule();
