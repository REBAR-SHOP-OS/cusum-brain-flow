
ALTER TABLE public.clearance_evidence
  ADD COLUMN IF NOT EXISTS evidence_valid boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS invalidated_at timestamptz,
  ADD COLUMN IF NOT EXISTS invalidated_by uuid,
  ADD COLUMN IF NOT EXISTS invalidation_reason text;

ALTER TABLE public.cut_plan_items DROP CONSTRAINT IF EXISTS cut_plan_items_phase_canonical_chk;
ALTER TABLE public.cut_plan_items
  ADD CONSTRAINT cut_plan_items_phase_canonical_chk
  CHECK (phase IN (
    'queued','cutting','bent','cut_done','clearance','cleared','zoned',
    'loading','loaded','ready_for_pickup','picked_up',
    'ready_for_delivery','driver_assigned','in_transit','delivered',
    'complete','closed'
  )) NOT VALID;
ALTER TABLE public.cut_plan_items VALIDATE CONSTRAINT cut_plan_items_phase_canonical_chk;

ALTER TABLE public.bundles DROP CONSTRAINT IF EXISTS bundles_status_canonical_chk;
ALTER TABLE public.bundles
  ADD CONSTRAINT bundles_status_canonical_chk
  CHECK (status IN (
    'building','ready_for_clearance','cleared','zoned',
    'loading','loaded','ready_for_pickup','picked_up',
    'ready_for_delivery','driver_assigned','in_transit','delivered',
    'closed','created'
  )) NOT VALID;
ALTER TABLE public.bundles VALIDATE CONSTRAINT bundles_status_canonical_chk;

ALTER TABLE public.cut_plans DROP CONSTRAINT IF EXISTS cut_plans_status_canonical_chk;
ALTER TABLE public.cut_plans
  ADD CONSTRAINT cut_plans_status_canonical_chk
  CHECK (status IN (
    'planning','draft','queued','in_production','ready_for_clearance',
    'cleared','ready_for_release','released',
    'ready_for_delivery','driver_assigned','in_transit','delivered',
    'completed','archived'
  )) NOT VALID;
ALTER TABLE public.cut_plans VALIDATE CONSTRAINT cut_plans_status_canonical_chk;

CREATE TABLE IF NOT EXISTS public.workflow_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN
    ('cut_plan_item','bundle','cut_plan','clearance_evidence')),
  entity_id uuid NOT NULL,
  from_state text,
  to_state text NOT NULL,
  reason text NOT NULL CHECK (length(reason) >= 10),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.workflow_overrides TO authenticated;
GRANT ALL ON public.workflow_overrides TO service_role;
ALTER TABLE public.workflow_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workflow_overrides_select ON public.workflow_overrides;
CREATE POLICY workflow_overrides_select ON public.workflow_overrides
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

DROP POLICY IF EXISTS workflow_overrides_insert ON public.workflow_overrides;
CREATE POLICY workflow_overrides_insert ON public.workflow_overrides
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = actor_id
    AND company_id = public.get_user_company_id(auth.uid())
    AND (public.has_role(auth.uid(),'admin'::app_role)
      OR public.has_role(auth.uid(),'shop_supervisor'::app_role))
  );

CREATE INDEX IF NOT EXISTS idx_workflow_overrides_entity
  ON public.workflow_overrides (entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_overrides_company
  ON public.workflow_overrides (company_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.manual_review_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  evidence_id uuid NOT NULL REFERENCES public.clearance_evidence(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL,
  decision text NOT NULL CHECK (decision IN ('approved','rejected')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.manual_review_decisions TO authenticated;
GRANT ALL ON public.manual_review_decisions TO service_role;
ALTER TABLE public.manual_review_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS manual_review_decisions_select ON public.manual_review_decisions;
CREATE POLICY manual_review_decisions_select ON public.manual_review_decisions
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

DROP POLICY IF EXISTS manual_review_decisions_insert ON public.manual_review_decisions;
CREATE POLICY manual_review_decisions_insert ON public.manual_review_decisions
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = reviewer_id
    AND company_id = public.get_user_company_id(auth.uid())
    AND (public.has_role(auth.uid(),'admin'::app_role)
      OR public.has_role(auth.uid(),'shop_supervisor'::app_role)
      OR public.has_role(auth.uid(),'workshop'::app_role))
  );

CREATE INDEX IF NOT EXISTS idx_manual_review_decisions_evidence
  ON public.manual_review_decisions (evidence_id, created_at DESC);

CREATE OR REPLACE FUNCTION public._workflow_override_active()
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_reason text;
BEGIN
  BEGIN v_reason := current_setting('app.override_reason', true);
  EXCEPTION WHEN OTHERS THEN v_reason := NULL; END;
  RETURN v_reason IS NOT NULL AND length(v_reason) >= 10;
END;
$$;

CREATE OR REPLACE FUNCTION public._is_evidence_release_ready(_evidence_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE e public.clearance_evidence%ROWTYPE;
BEGIN
  IF _evidence_id IS NULL THEN RETURN false; END IF;
  SELECT * INTO e FROM public.clearance_evidence WHERE id = _evidence_id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF e.material_photo_url IS NULL THEN RETURN false; END IF;
  IF NOT (e.tag_scan_url IS NOT NULL OR e.verification_state = 'manual_verified') THEN RETURN false; END IF;
  IF e.verified_by IS NULL OR e.verified_at IS NULL THEN RETURN false; END IF;
  IF e.evidence_valid IS DISTINCT FROM true OR e.invalidated_at IS NOT NULL THEN RETURN false; END IF;
  IF e.ai_confidence IS NULL THEN RETURN false; END IF;
  IF e.ai_confidence >= 0.95 THEN RETURN true; END IF;
  IF e.ai_confidence < 0.70 THEN RETURN false; END IF;
  RETURN EXISTS (SELECT 1 FROM public.manual_review_decisions WHERE evidence_id = e.id AND decision = 'approved');
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_cut_plan_item_transition()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_allowed boolean := false; v_evidence_id uuid; v_machine_run_exists boolean;
BEGIN
  IF NEW.phase IS NOT DISTINCT FROM OLD.phase THEN RETURN NEW; END IF;
  v_allowed := CASE OLD.phase
    WHEN 'queued'             THEN NEW.phase IN ('cutting','cut_done','clearance')
    WHEN 'cutting'            THEN NEW.phase IN ('bent','cut_done','clearance')
    WHEN 'bent'               THEN NEW.phase IN ('clearance')
    WHEN 'cut_done'           THEN NEW.phase IN ('bent','clearance')
    WHEN 'clearance'          THEN NEW.phase IN ('cleared')
    WHEN 'cleared'            THEN NEW.phase IN ('zoned','loading','complete')
    WHEN 'zoned'              THEN NEW.phase IN ('loading')
    WHEN 'loading'            THEN NEW.phase IN ('loaded')
    WHEN 'loaded'             THEN NEW.phase IN ('ready_for_pickup','ready_for_delivery')
    WHEN 'ready_for_pickup'   THEN NEW.phase IN ('picked_up')
    WHEN 'picked_up'          THEN NEW.phase IN ('complete','closed')
    WHEN 'ready_for_delivery' THEN NEW.phase IN ('driver_assigned')
    WHEN 'driver_assigned'    THEN NEW.phase IN ('in_transit')
    WHEN 'in_transit'         THEN NEW.phase IN ('delivered')
    WHEN 'delivered'          THEN NEW.phase IN ('complete','closed')
    WHEN 'complete'           THEN NEW.phase IN ('closed')
    ELSE false
  END;
  IF NOT v_allowed AND NOT public._workflow_override_active() THEN
    RAISE EXCEPTION 'WORKFLOW_GATE_ADJACENCY: cut_plan_items % -> % not allowed', OLD.phase, NEW.phase USING ERRCODE='P0001';
  END IF;

  IF OLD.phase = 'queued' AND NEW.phase = 'cutting' AND NOT public._workflow_override_active() THEN
    IF NEW.work_order_id IS NOT NULL THEN
      SELECT EXISTS(SELECT 1 FROM public.machine_runs WHERE work_order_id = NEW.work_order_id) INTO v_machine_run_exists;
      IF NOT v_machine_run_exists THEN
        RAISE EXCEPTION 'WORKFLOW_GATE_CUTTER_NO_MACHINE_RUN: queued -> cutting requires machine_runs row' USING ERRCODE='P0001';
      END IF;
    END IF;
  END IF;

  IF NEW.phase = 'clearance' AND OLD.phase IN ('bent','cut_done') AND NOT public._workflow_override_active() THEN
    IF COALESCE(NEW.bend_completed_pieces,0) < COALESCE(NEW.total_pieces,0) THEN
      RAISE EXCEPTION 'WORKFLOW_GATE_BEND_INCOMPLETE: bend_completed_pieces (%) < total_pieces (%)',
        NEW.bend_completed_pieces, NEW.total_pieces USING ERRCODE='P0001';
    END IF;
  END IF;

  IF NEW.phase = 'cleared' AND OLD.phase <> 'cleared' AND NOT public._workflow_override_active() THEN
    SELECT id INTO v_evidence_id FROM public.clearance_evidence
      WHERE cut_plan_item_id = NEW.id ORDER BY created_at DESC LIMIT 1;
    IF NOT public._is_evidence_release_ready(v_evidence_id) THEN
      RAISE EXCEPTION 'WORKFLOW_GATE_CLEARANCE_EVIDENCE: item % cannot enter cleared — evidence missing/invalid/low-confidence', NEW.id USING ERRCODE='P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_cut_plan_item_transition ON public.cut_plan_items;
CREATE TRIGGER trg_validate_cut_plan_item_transition
  BEFORE UPDATE ON public.cut_plan_items
  FOR EACH ROW EXECUTE FUNCTION public.validate_cut_plan_item_transition();

CREATE OR REPLACE FUNCTION public.validate_bundle_transition()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_allowed boolean := false;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  v_allowed := CASE OLD.status
    WHEN 'created'             THEN NEW.status IN ('building','ready_for_clearance')
    WHEN 'building'            THEN NEW.status IN ('ready_for_clearance')
    WHEN 'ready_for_clearance' THEN NEW.status IN ('cleared')
    WHEN 'cleared'             THEN NEW.status IN ('zoned','loading')
    WHEN 'zoned'               THEN NEW.status IN ('loading')
    WHEN 'loading'             THEN NEW.status IN ('loaded')
    WHEN 'loaded'              THEN NEW.status IN ('ready_for_pickup','ready_for_delivery')
    WHEN 'ready_for_pickup'    THEN NEW.status IN ('picked_up')
    WHEN 'picked_up'           THEN NEW.status IN ('closed')
    WHEN 'ready_for_delivery'  THEN NEW.status IN ('driver_assigned')
    WHEN 'driver_assigned'     THEN NEW.status IN ('in_transit')
    WHEN 'in_transit'          THEN NEW.status IN ('delivered')
    WHEN 'delivered'           THEN NEW.status IN ('closed')
    ELSE false
  END;
  IF NOT v_allowed AND NOT public._workflow_override_active() THEN
    RAISE EXCEPTION 'WORKFLOW_GATE_ADJACENCY: bundles % -> % not allowed', OLD.status, NEW.status USING ERRCODE='P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_bundle_transition ON public.bundles;
CREATE TRIGGER trg_validate_bundle_transition
  BEFORE UPDATE ON public.bundles
  FOR EACH ROW EXECUTE FUNCTION public.validate_bundle_transition();

CREATE OR REPLACE FUNCTION public.validate_cut_plan_transition()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_allowed boolean := false;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  v_allowed := CASE OLD.status
    WHEN 'draft'               THEN NEW.status IN ('planning','queued','archived')
    WHEN 'planning'            THEN NEW.status IN ('queued','draft','archived')
    WHEN 'queued'              THEN NEW.status IN ('in_production','ready_for_clearance','completed','archived')
    WHEN 'in_production'       THEN NEW.status IN ('ready_for_clearance','completed','archived')
    WHEN 'ready_for_clearance' THEN NEW.status IN ('cleared','archived')
    WHEN 'cleared'             THEN NEW.status IN ('ready_for_release','completed','archived')
    WHEN 'ready_for_release'   THEN NEW.status IN ('released','archived')
    WHEN 'released'            THEN NEW.status IN ('ready_for_delivery','completed','archived')
    WHEN 'ready_for_delivery'  THEN NEW.status IN ('driver_assigned','archived')
    WHEN 'driver_assigned'     THEN NEW.status IN ('in_transit','archived')
    WHEN 'in_transit'          THEN NEW.status IN ('delivered','archived')
    WHEN 'delivered'           THEN NEW.status IN ('completed','archived')
    WHEN 'completed'           THEN NEW.status IN ('archived')
    ELSE false
  END;
  IF NOT v_allowed AND NOT public._workflow_override_active() THEN
    RAISE EXCEPTION 'WORKFLOW_GATE_ADJACENCY: cut_plans % -> % not allowed', OLD.status, NEW.status USING ERRCODE='P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_cut_plan_transition ON public.cut_plans;
CREATE TRIGGER trg_validate_cut_plan_transition
  BEFORE UPDATE ON public.cut_plans
  FOR EACH ROW EXECUTE FUNCTION public.validate_cut_plan_transition();

CREATE OR REPLACE FUNCTION public.validate_clearance_evidence_transition()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cleared' AND COALESCE(OLD.status,'') <> 'cleared' AND NOT public._workflow_override_active() THEN
    IF NEW.material_photo_url IS NULL THEN
      RAISE EXCEPTION 'WORKFLOW_GATE_EVIDENCE_PHOTO: material_photo_url required' USING ERRCODE='P0001';
    END IF;
    IF NOT (NEW.tag_scan_url IS NOT NULL OR NEW.verification_state = 'manual_verified') THEN
      RAISE EXCEPTION 'WORKFLOW_GATE_EVIDENCE_TAG_OR_MANUAL: tag scan or manual verification required' USING ERRCODE='P0001';
    END IF;
    IF NEW.verified_by IS NULL OR NEW.verified_at IS NULL THEN
      RAISE EXCEPTION 'WORKFLOW_GATE_EVIDENCE_VERIFIER: verified_by and verified_at required' USING ERRCODE='P0001';
    END IF;
    IF NEW.evidence_valid IS DISTINCT FROM true OR NEW.invalidated_at IS NOT NULL THEN
      RAISE EXCEPTION 'WORKFLOW_GATE_EVIDENCE_INVALIDATED: evidence has been invalidated' USING ERRCODE='P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_clearance_evidence_transition ON public.clearance_evidence;
CREATE TRIGGER trg_validate_clearance_evidence_transition
  BEFORE UPDATE ON public.clearance_evidence
  FOR EACH ROW EXECUTE FUNCTION public.validate_clearance_evidence_transition();

DROP VIEW IF EXISTS public.entity_state_v;
CREATE VIEW public.entity_state_v WITH (security_invoker = true) AS
  SELECT cpi.id AS id, cp.company_id AS company_id, 'cut_plan_item'::text AS entity_type, cpi.phase AS state
    FROM public.cut_plan_items cpi
    JOIN public.cut_plans cp ON cp.id = cpi.cut_plan_id
  UNION ALL
  SELECT b.id, b.company_id, 'bundle'::text, b.status FROM public.bundles b
  UNION ALL
  SELECT cp.id, cp.company_id, 'cut_plan'::text, cp.status FROM public.cut_plans cp;
GRANT SELECT ON public.entity_state_v TO authenticated;

CREATE OR REPLACE FUNCTION public.workflow_override_transition(
  _entity_type text, _entity_id uuid, _to_state text, _reason text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_company_id uuid; v_from_state text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'WORKFLOW_OVERRIDE_AUTH: not authenticated' USING ERRCODE='28000';
  END IF;
  IF NOT (public.has_role(v_uid,'admin'::app_role) OR public.has_role(v_uid,'shop_supervisor'::app_role)) THEN
    RAISE EXCEPTION 'WORKFLOW_OVERRIDE_FORBIDDEN: admin or shop_supervisor required' USING ERRCODE='42501';
  END IF;
  IF _reason IS NULL OR length(_reason) < 10 THEN
    RAISE EXCEPTION 'WORKFLOW_OVERRIDE_REASON: reason must be at least 10 chars' USING ERRCODE='22023';
  END IF;
  IF _entity_type NOT IN ('cut_plan_item','bundle','cut_plan','clearance_evidence') THEN
    RAISE EXCEPTION 'WORKFLOW_OVERRIDE_ENTITY: unknown entity_type %', _entity_type USING ERRCODE='22023';
  END IF;

  IF _entity_type = 'cut_plan_item' THEN
    SELECT cpi.phase, cp.company_id INTO v_from_state, v_company_id
      FROM public.cut_plan_items cpi JOIN public.cut_plans cp ON cp.id = cpi.cut_plan_id
      WHERE cpi.id = _entity_id;
  ELSIF _entity_type = 'bundle' THEN
    SELECT status, company_id INTO v_from_state, v_company_id FROM public.bundles WHERE id = _entity_id;
  ELSIF _entity_type = 'cut_plan' THEN
    SELECT status, company_id INTO v_from_state, v_company_id FROM public.cut_plans WHERE id = _entity_id;
  ELSE
    SELECT ce.status, cp.company_id INTO v_from_state, v_company_id
      FROM public.clearance_evidence ce
      JOIN public.cut_plan_items cpi ON cpi.id = ce.cut_plan_item_id
      JOIN public.cut_plans cp ON cp.id = cpi.cut_plan_id
      WHERE ce.id = _entity_id;
  END IF;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'WORKFLOW_OVERRIDE_NOT_FOUND: % %', _entity_type, _entity_id USING ERRCODE='02000';
  END IF;
  IF v_company_id <> public.get_user_company_id(v_uid) THEN
    RAISE EXCEPTION 'WORKFLOW_OVERRIDE_TENANT: cross-company override denied' USING ERRCODE='42501';
  END IF;

  INSERT INTO public.workflow_overrides
    (company_id, actor_id, entity_type, entity_id, from_state, to_state, reason)
  VALUES (v_company_id, v_uid, _entity_type, _entity_id, v_from_state, _to_state, _reason);

  PERFORM set_config('app.override_reason', _reason, true);

  IF _entity_type = 'cut_plan_item' THEN
    UPDATE public.cut_plan_items SET phase = _to_state WHERE id = _entity_id;
  ELSIF _entity_type = 'bundle' THEN
    UPDATE public.bundles SET status = _to_state WHERE id = _entity_id;
  ELSIF _entity_type = 'cut_plan' THEN
    UPDATE public.cut_plans SET status = _to_state WHERE id = _entity_id;
  ELSE
    UPDATE public.clearance_evidence SET status = _to_state WHERE id = _entity_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.workflow_override_transition(text,uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.workflow_override_transition(text,uuid,text,text) TO authenticated;
