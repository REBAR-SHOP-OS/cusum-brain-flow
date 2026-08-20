
-- ============================================================
-- ERP Autopilot: autopilot_runs + autopilot_actions
-- ============================================================

-- Autopilot Runs — each run captures a full phased execution
CREATE TABLE public.autopilot_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  trigger_type TEXT NOT NULL DEFAULT 'manual',
  phase TEXT NOT NULL DEFAULT 'context_capture',
  status TEXT NOT NULL DEFAULT 'pending',
  context_snapshot JSONB DEFAULT '{}',
  plan JSONB DEFAULT '[]',
  simulation_result JSONB DEFAULT '{}',
  approval_note TEXT,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_log JSONB DEFAULT '[]',
  metrics JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Autopilot Actions — individual actions within a run
CREATE TABLE public.autopilot_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES public.autopilot_runs(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL DEFAULT 0,
  tool_name TEXT NOT NULL,
  tool_params JSONB NOT NULL DEFAULT '{}',
  risk_level TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'pending',
  requires_approval BOOLEAN NOT NULL DEFAULT true,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  result JSONB,
  error_message TEXT,
  rollback_metadata JSONB DEFAULT '{}',
  rollback_executed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Validation trigger for autopilot_runs
CREATE OR REPLACE FUNCTION public.validate_autopilot_run_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.trigger_type NOT IN ('manual', 'scheduled', 'event', 'auto_fix') THEN
    RAISE EXCEPTION 'Invalid trigger_type: %', NEW.trigger_type;
  END IF;
  IF NEW.phase NOT IN ('context_capture', 'planning', 'simulation', 'approval', 'execution', 'observation', 'completed', 'failed', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid phase: %', NEW.phase;
  END IF;
  IF NEW.status NOT IN ('pending', 'running', 'awaiting_approval', 'approved', 'executing', 'completed', 'failed', 'cancelled', 'rolled_back') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_autopilot_run_trigger
BEFORE INSERT OR UPDATE ON public.autopilot_runs
FOR EACH ROW EXECUTE FUNCTION public.validate_autopilot_run_fields();

-- Validation trigger for autopilot_actions
CREATE OR REPLACE FUNCTION public.validate_autopilot_action_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.risk_level NOT IN ('low', 'medium', 'high', 'critical') THEN
    RAISE EXCEPTION 'Invalid risk_level: %', NEW.risk_level;
  END IF;
  IF NEW.status NOT IN ('pending', 'approved', 'rejected', 'executing', 'completed', 'failed', 'skipped', 'rolled_back') THEN
    RAISE EXCEPTION 'Invalid action status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_autopilot_action_trigger
BEFORE INSERT OR UPDATE ON public.autopilot_actions
FOR EACH ROW EXECUTE FUNCTION public.validate_autopilot_action_fields();

-- Updated_at triggers
CREATE TRIGGER update_autopilot_runs_updated_at
BEFORE UPDATE ON public.autopilot_runs
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_autopilot_actions_updated_at
BEFORE UPDATE ON public.autopilot_actions
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Enable RLS
ALTER TABLE public.autopilot_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.autopilot_actions ENABLE ROW LEVEL SECURITY;

-- RLS: users see company runs
CREATE POLICY "Users view company autopilot runs"
ON public.autopilot_runs FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()));

-- RLS: users can create runs
CREATE POLICY "Users create autopilot runs"
ON public.autopilot_runs FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND company_id = public.get_user_company_id(auth.uid())
);

-- RLS: admins can update runs (approve/reject/advance)
CREATE POLICY "Admins update autopilot runs"
ON public.autopilot_runs FOR UPDATE TO authenticated
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- RLS: actions visible via run's company
CREATE POLICY "Users view company autopilot actions"
ON public.autopilot_actions FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.autopilot_runs r
    WHERE r.id = run_id
    AND r.company_id = public.get_user_company_id(auth.uid())
  )
);

-- RLS: admins can update actions
CREATE POLICY "Admins update autopilot actions"
ON public.autopilot_actions FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.autopilot_runs r
    WHERE r.id = run_id
    AND r.company_id = public.get_user_company_id(auth.uid())
  )
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- Service role full access for edge functions
CREATE POLICY "Service role full access runs"
ON public.autopilot_runs FOR ALL
USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access actions"
ON public.autopilot_actions FOR ALL
USING (auth.role() = 'service_role');

-- Indexes for performance
CREATE INDEX idx_autopilot_runs_company_status ON public.autopilot_runs(company_id, status);
CREATE INDEX idx_autopilot_runs_phase ON public.autopilot_runs(phase);
CREATE INDEX idx_autopilot_actions_run_id ON public.autopilot_actions(run_id, step_order);
CREATE INDEX idx_autopilot_actions_status ON public.autopilot_actions(status);
