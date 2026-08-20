
CREATE TABLE IF NOT EXISTS public.cut_plan_item_phase_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL,
  cut_plan_item_id uuid NOT NULL,
  cut_plan_id  uuid,
  work_order_id uuid,
  from_phase   text,
  to_phase     text NOT NULL,
  actor_id     uuid,
  device       text,
  source       text,
  metadata     jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cpi_phase_log_item ON public.cut_plan_item_phase_log(cut_plan_item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cpi_phase_log_company ON public.cut_plan_item_phase_log(company_id, created_at DESC);

GRANT SELECT ON public.cut_plan_item_phase_log TO authenticated;
GRANT ALL ON public.cut_plan_item_phase_log TO service_role;

ALTER TABLE public.cut_plan_item_phase_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "phase_log_company_select" ON public.cut_plan_item_phase_log;
CREATE POLICY "phase_log_company_select"
  ON public.cut_plan_item_phase_log
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE OR REPLACE FUNCTION public.log_cut_plan_item_phase_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_headers jsonb;
  v_device text;
  v_source text;
  v_meta jsonb;
  v_company uuid;
BEGIN
  IF NEW.phase IS NOT DISTINCT FROM OLD.phase THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_headers := current_setting('request.headers', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_headers := '{}'::jsonb;
  END;
  v_device := v_headers->>'x-device-id';
  v_source := COALESCE(v_headers->>'x-app-source', 'app');

  SELECT cp.company_id INTO v_company FROM public.cut_plans cp WHERE cp.id = NEW.cut_plan_id;

  v_meta := jsonb_build_object(
    'from_phase', OLD.phase,
    'to_phase', NEW.phase,
    'mark_number', NEW.mark_number,
    'bar_code', NEW.bar_code,
    'completed_pieces', NEW.completed_pieces,
    'bend_completed_pieces', NEW.bend_completed_pieces,
    'total_pieces', NEW.total_pieces,
    'work_order_id', NEW.work_order_id,
    'override_active', public._workflow_override_active()
  );

  INSERT INTO public.cut_plan_item_phase_log(
    company_id, cut_plan_item_id, cut_plan_id, work_order_id,
    from_phase, to_phase, actor_id, device, source, metadata
  ) VALUES (
    v_company, NEW.id, NEW.cut_plan_id, NEW.work_order_id,
    OLD.phase, NEW.phase, v_actor, v_device, v_source, v_meta
  );

  INSERT INTO public.activity_events(
    company_id, entity_type, entity_id, event_type, description,
    source, actor_id, actor_type, metadata
  ) VALUES (
    v_company, 'cut_plan_item', NEW.id, 'audit',
    format('phase: %s → %s', COALESCE(OLD.phase,'∅'), NEW.phase),
    'phase_transition', v_actor,
    CASE WHEN v_actor IS NULL THEN 'system' ELSE 'user' END,
    v_meta
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'phase log failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_cut_plan_item_phase_transition ON public.cut_plan_items;
CREATE TRIGGER trg_log_cut_plan_item_phase_transition
AFTER UPDATE OF phase ON public.cut_plan_items
FOR EACH ROW
EXECUTE FUNCTION public.log_cut_plan_item_phase_transition();
