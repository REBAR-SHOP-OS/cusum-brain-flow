-- Consolidated A8 storage-zone contract: Zone 1-7 + validator + audit.
-- All re-declarations are idempotent (CREATE OR REPLACE / DROP IF EXISTS).

ALTER TABLE public.clearance_evidence
  DROP CONSTRAINT IF EXISTS clearance_evidence_storage_zone_chk;

ALTER TABLE public.clearance_evidence
  ADD CONSTRAINT clearance_evidence_storage_zone_chk
  CHECK (storage_zone IS NULL OR storage_zone IN ('Zone 1','Zone 2','Zone 3','Zone 4','Zone 5','Zone 6','Zone 7'));

CREATE OR REPLACE FUNCTION public.validate_clearance_evidence_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cleared'
     AND (OLD.status IS DISTINCT FROM 'cleared')
     AND NOT public._workflow_override_active() THEN
    IF NEW.storage_zone IS NULL OR btrim(NEW.storage_zone) = '' THEN
      RAISE EXCEPTION 'WORKFLOW_GATE_STORAGE_ZONE_REQUIRED'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_clearance_zone_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _company_id uuid;
BEGIN
  IF NEW.storage_zone IS DISTINCT FROM COALESCE(OLD.storage_zone, NULL)
     AND NEW.storage_zone IS NOT NULL THEN
    SELECT cp.company_id INTO _company_id
      FROM public.cut_plan_items ci
      JOIN public.cut_plans cp ON cp.id = ci.cut_plan_id
     WHERE ci.id = NEW.cut_plan_item_id
     LIMIT 1;

    INSERT INTO public.activity_events (
      company_id, event_type, entity_type, entity_id, actor_id, payload
    ) VALUES (
      _company_id,
      'audit',
      'clearance_evidence',
      NEW.id,
      auth.uid(),
      jsonb_build_object(
        'action', 'storage_zone_assigned',
        'cut_plan_item_id', NEW.cut_plan_item_id,
        'previous_zone', OLD.storage_zone,
        'new_zone', NEW.storage_zone
      )
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_log_clearance_zone_assignment ON public.clearance_evidence;
CREATE TRIGGER trg_log_clearance_zone_assignment
AFTER INSERT OR UPDATE OF storage_zone ON public.clearance_evidence
FOR EACH ROW
EXECUTE FUNCTION public.log_clearance_zone_assignment();
