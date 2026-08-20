
-- =============================================
-- Phase 1: Agents v2 Infrastructure
-- =============================================

-- 1A. agents registry
CREATE TABLE public.agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  default_role TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read agents"
  ON public.agents FOR SELECT TO authenticated
  USING (true);

-- Seed the 3 agents
INSERT INTO public.agents (code, name, default_role) VALUES
  ('vizzy', 'Vizzy', 'admin'),
  ('penny', 'Penny', 'accounting'),
  ('forge', 'Forge', 'workshop');

-- 1B. user_agents (1:1 mapping)
CREATE TABLE public.user_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  mode TEXT NOT NULL DEFAULT 'auto_by_role',
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own agent assignment"
  ON public.user_agents FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins read all agent assignments"
  ON public.user_agents FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage agent assignments"
  ON public.user_agents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 1C. Enhance suggestions table
ALTER TABLE public.suggestions
  ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES public.agents(id),
  ADD COLUMN IF NOT EXISTS entity_type TEXT,
  ADD COLUMN IF NOT EXISTS entity_id TEXT,
  ADD COLUMN IF NOT EXISTS severity TEXT NOT NULL DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS impact TEXT,
  ADD COLUMN IF NOT EXISTS actions JSONB,
  ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_suggestions_agent_status ON public.suggestions (agent_id, status);
CREATE INDEX IF NOT EXISTS idx_suggestions_entity ON public.suggestions (entity_type, entity_id);

-- 1D. agent_action_log (audit trail)
CREATE TABLE public.agent_action_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES public.agents(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  company_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  payload JSONB,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_action_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own action log"
  ON public.agent_action_log FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins read all action logs"
  ON public.agent_action_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users insert own action logs"
  ON public.agent_action_log FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND company_id = public.get_user_company_id(auth.uid()));

-- 1E. Add voice columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_voice_id TEXT,
  ADD COLUMN IF NOT EXISTS voice_enabled BOOLEAN NOT NULL DEFAULT false;

-- Auto-assign trigger on user_roles
CREATE OR REPLACE FUNCTION public.auto_assign_agent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _agent_id UUID;
  _company_id UUID;
BEGIN
  -- Determine agent based on role
  SELECT id INTO _agent_id FROM public.agents WHERE code = CASE
    WHEN NEW.role = 'admin' THEN 'vizzy'
    WHEN NEW.role = 'accounting' THEN 'penny'
    WHEN NEW.role IN ('workshop', 'field') THEN 'forge'
    ELSE NULL
  END AND enabled = true;

  IF _agent_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT company_id INTO _company_id FROM public.profiles WHERE user_id = NEW.user_id LIMIT 1;
  IF _company_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.user_agents (user_id, agent_id, company_id, mode)
  VALUES (NEW.user_id, _agent_id, _company_id, 'auto_by_role')
  ON CONFLICT (user_id) DO UPDATE SET
    agent_id = EXCLUDED.agent_id,
    assigned_at = now()
  WHERE user_agents.mode = 'auto_by_role';

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_assign_agent
  AFTER INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_agent();
