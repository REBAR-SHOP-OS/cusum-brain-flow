
-- ============================================================
-- Phase 1: Central Brain Event Ledger
-- ============================================================

-- 1a. Rename events → activity_events
ALTER TABLE public.events RENAME TO activity_events;

-- 1b. Add new ledger columns
ALTER TABLE public.activity_events
  ADD COLUMN source text NOT NULL DEFAULT 'system',
  ADD COLUMN dedupe_key text,
  ADD COLUMN inputs_snapshot jsonb,
  ADD COLUMN processed_at timestamptz;

-- 1c. Convert entity_id from uuid to text for external IDs
ALTER TABLE public.activity_events
  ALTER COLUMN entity_id TYPE text USING entity_id::text;

-- 1d. Partial unique index for idempotent inserts
CREATE UNIQUE INDEX idx_activity_events_dedupe_key
  ON public.activity_events (dedupe_key)
  WHERE dedupe_key IS NOT NULL;

-- 1e. Index for rule-engine polling (unprocessed events)
CREATE INDEX idx_activity_events_unprocessed
  ON public.activity_events (company_id, created_at)
  WHERE processed_at IS NULL;

-- 1f. Backward-compat view so any missed references still work
CREATE VIEW public.events AS SELECT * FROM public.activity_events;

-- ============================================================
-- 2. human_tasks table
-- ============================================================
CREATE TABLE public.human_tasks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL,
  agent_id        uuid REFERENCES public.agents(id),
  source_event_id uuid REFERENCES public.activity_events(id),
  dedupe_key      text,
  title           text NOT NULL,
  description     text,
  severity        text NOT NULL DEFAULT 'info',
  category        text,
  entity_type     text,
  entity_id       text,
  inputs_snapshot jsonb,
  assigned_to     uuid,
  status          text NOT NULL DEFAULT 'open',
  resolved_at     timestamptz,
  snoozed_until   timestamptz,
  actions         jsonb,
  reason          text,
  impact          text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Partial unique index for dedupe
CREATE UNIQUE INDEX idx_human_tasks_dedupe_key
  ON public.human_tasks (dedupe_key)
  WHERE dedupe_key IS NOT NULL;

-- Timestamps trigger
CREATE TRIGGER update_human_tasks_updated_at
  BEFORE UPDATE ON public.human_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3. RLS on activity_events (re-apply after rename)
-- ============================================================
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_events_select" ON public.activity_events
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "activity_events_insert" ON public.activity_events
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "activity_events_update" ON public.activity_events
  FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "activity_events_delete" ON public.activity_events
  FOR DELETE TO authenticated
  USING (
    company_id = public.get_user_company_id(auth.uid())
    AND public.has_role(auth.uid(), 'admin')
  );

-- ============================================================
-- 4. RLS on human_tasks
-- ============================================================
ALTER TABLE public.human_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "human_tasks_select" ON public.human_tasks
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "human_tasks_insert" ON public.human_tasks
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "human_tasks_update" ON public.human_tasks
  FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "human_tasks_delete" ON public.human_tasks
  FOR DELETE TO authenticated
  USING (
    company_id = public.get_user_company_id(auth.uid())
    AND public.has_role(auth.uid(), 'admin')
  );

-- ============================================================
-- 5. Register missing agents
-- ============================================================
INSERT INTO public.agents (code, name, default_role, enabled) VALUES
  ('relay', 'Relay', 'sales', true),
  ('gauge', 'Gauge', 'admin', true),
  ('atlas', 'Atlas', 'field', true),
  ('blitz', 'Blitz', 'sales', true),
  ('pixel', 'Pixel', 'admin', true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 6. Validate human_tasks status
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_human_task_status()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = 'public'
AS $$
BEGIN
  IF NEW.status NOT IN ('open', 'snoozed', 'acted', 'dismissed', 'resolved') THEN
    RAISE EXCEPTION 'Invalid human_task status: %', NEW.status;
  END IF;
  IF NEW.severity NOT IN ('info', 'warning', 'critical') THEN
    RAISE EXCEPTION 'Invalid human_task severity: %', NEW.severity;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_human_task_before_upsert
  BEFORE INSERT OR UPDATE ON public.human_tasks
  FOR EACH ROW EXECUTE FUNCTION public.validate_human_task_status();
