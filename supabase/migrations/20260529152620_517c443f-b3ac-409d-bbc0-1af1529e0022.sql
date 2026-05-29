
-- B6 Loading Validation → Packing Slip Gate
-- Surgical, additive: BEFORE INSERT trigger on packing_slips validates the
-- loading_checklist against cut_plan_items. Respects _workflow_override_active().

CREATE OR REPLACE FUNCTION public.validate_packing_slip_loading()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _expected         integer := 0;
  _loaded_total     integer := 0;
  _loaded_in_plan   integer := 0;
  _json_count       integer := 0;
  _json_distinct    integer := 0;
BEGIN
  -- Legacy / manual slips with no cut_plan_id are not gated here.
  IF NEW.cut_plan_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF public._workflow_override_active() THEN
    RETURN NEW;
  END IF;

  -- Expected: items in the cut plan.
  SELECT count(*) INTO _expected
    FROM public.cut_plan_items
   WHERE cut_plan_id = NEW.cut_plan_id;

  IF _expected = 0 THEN
    RAISE EXCEPTION 'WORKFLOW_GATE_LOADING_NO_ITEMS: cut plan has no items to load'
      USING ERRCODE = 'P0001';
  END IF;

  -- Loaded rows for this plan (regardless of whether the item belongs here).
  SELECT count(*) INTO _loaded_total
    FROM public.loading_checklist
   WHERE cut_plan_id = NEW.cut_plan_id
     AND loaded = true;

  IF _loaded_total = 0 THEN
    RAISE EXCEPTION 'WORKFLOW_GATE_LOADING_NOT_STARTED: no items have been marked loaded for this bundle'
      USING ERRCODE = 'P0001';
  END IF;

  -- Loaded rows whose cut_plan_item actually belongs to this plan.
  SELECT count(*) INTO _loaded_in_plan
    FROM public.loading_checklist lc
    JOIN public.cut_plan_items ci ON ci.id = lc.cut_plan_item_id
   WHERE lc.cut_plan_id = NEW.cut_plan_id
     AND lc.loaded = true
     AND ci.cut_plan_id = NEW.cut_plan_id;

  -- Wrong item: a loaded checklist row points to a cut_plan_item from a
  -- different plan (slipped through despite unique(cut_plan_id,item_id)).
  IF _loaded_total <> _loaded_in_plan THEN
    RAISE EXCEPTION 'WORKFLOW_GATE_LOADING_WRONG_ITEM: a loaded item does not belong to this cut plan'
      USING ERRCODE = 'P0001';
  END IF;

  -- Missing / partial: fewer loaded than expected.
  IF _loaded_in_plan < _expected THEN
    RAISE EXCEPTION 'WORKFLOW_GATE_LOADING_INCOMPLETE: % of % items loaded', _loaded_in_plan, _expected
      USING ERRCODE = 'P0001';
  END IF;

  -- Overload: more loaded than the plan expects.
  IF _loaded_in_plan > _expected THEN
    RAISE EXCEPTION 'WORKFLOW_GATE_LOADING_OVERLOAD: % loaded but plan expects %', _loaded_in_plan, _expected
      USING ERRCODE = 'P0001';
  END IF;

  -- Duplicate scans inside items_json (same item listed twice on the slip).
  IF jsonb_typeof(NEW.items_json) = 'array' THEN
    SELECT count(*), count(DISTINCT elem->>'id')
      INTO _json_count, _json_distinct
      FROM jsonb_array_elements(NEW.items_json) elem
     WHERE elem ? 'id' AND elem->>'id' IS NOT NULL;

    IF _json_count > 0 AND _json_distinct < _json_count THEN
      RAISE EXCEPTION 'WORKFLOW_GATE_LOADING_DUPLICATE: duplicate item id in packing slip contents'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_validate_packing_slip_loading ON public.packing_slips;
CREATE TRIGGER trg_validate_packing_slip_loading
BEFORE INSERT ON public.packing_slips
FOR EACH ROW
EXECUTE FUNCTION public.validate_packing_slip_loading();

-- Audit event after a packing slip successfully passes the gate.
CREATE OR REPLACE FUNCTION public.log_packing_slip_validated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _expected     integer := 0;
  _loaded_count integer := 0;
BEGIN
  IF NEW.cut_plan_id IS NOT NULL THEN
    SELECT count(*) INTO _expected
      FROM public.cut_plan_items WHERE cut_plan_id = NEW.cut_plan_id;
    SELECT count(*) INTO _loaded_count
      FROM public.loading_checklist
     WHERE cut_plan_id = NEW.cut_plan_id AND loaded = true;
  END IF;

  INSERT INTO public.activity_events (
    company_id, event_type, entity_type, entity_id, actor_id, source, description, metadata
  ) VALUES (
    NEW.company_id,
    'audit',
    'packing_slip',
    NEW.id::text,
    auth.uid()::text,
    'workflow_gate',
    'packing_slip_validated',
    jsonb_build_object(
      'action',          'packing_slip_validated',
      'cut_plan_id',     NEW.cut_plan_id,
      'slip_number',     NEW.slip_number,
      'expected_items',  _expected,
      'loaded_items',    _loaded_count,
      'override_active', public._workflow_override_active()
    )
  );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_log_packing_slip_validated ON public.packing_slips;
CREATE TRIGGER trg_log_packing_slip_validated
AFTER INSERT ON public.packing_slips
FOR EACH ROW
EXECUTE FUNCTION public.log_packing_slip_validated();
