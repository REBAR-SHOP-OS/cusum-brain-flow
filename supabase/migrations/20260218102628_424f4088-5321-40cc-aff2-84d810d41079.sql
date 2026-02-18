
-- Create pipeline_ai_actions table
CREATE TABLE public.pipeline_ai_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
  action_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'medium',
  ai_reasoning TEXT,
  suggested_data JSONB DEFAULT '{}',
  company_id UUID NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pipeline_ai_actions ENABLE ROW LEVEL SECURITY;

-- RLS policies (company-scoped)
CREATE POLICY "Users can view their company AI actions"
  ON public.pipeline_ai_actions FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert AI actions for their company"
  ON public.pipeline_ai_actions FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can update their company AI actions"
  ON public.pipeline_ai_actions FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete their company AI actions"
  ON public.pipeline_ai_actions FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

-- Validation trigger
CREATE OR REPLACE FUNCTION public.validate_pipeline_ai_action_fields()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.action_type NOT IN ('move_stage', 'send_followup', 'set_reminder', 'flag_stale', 'score_update') THEN
    RAISE EXCEPTION 'Invalid action_type: %', NEW.action_type;
  END IF;
  IF NEW.status NOT IN ('pending', 'approved', 'executed', 'dismissed') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  IF NEW.priority NOT IN ('critical', 'high', 'medium', 'low') THEN
    RAISE EXCEPTION 'Invalid priority: %', NEW.priority;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_pipeline_ai_action
  BEFORE INSERT OR UPDATE ON public.pipeline_ai_actions
  FOR EACH ROW EXECUTE FUNCTION public.validate_pipeline_ai_action_fields();

-- Updated_at trigger
CREATE TRIGGER update_pipeline_ai_actions_updated_at
  BEFORE UPDATE ON public.pipeline_ai_actions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Index for fast lookups
CREATE INDEX idx_pipeline_ai_actions_company_status ON public.pipeline_ai_actions(company_id, status);
CREATE INDEX idx_pipeline_ai_actions_lead ON public.pipeline_ai_actions(lead_id);
