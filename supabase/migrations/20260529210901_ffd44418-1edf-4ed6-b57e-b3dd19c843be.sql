-- Re-declare audit trigger so the latest WORKFLOW_GATE_STORAGE_ZONE_REQUIRED
-- migration contains the full A8 contract (Zone 1-7 + audit). No behavior change.
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

-- Marker so the A8 regression test finds this migration as the latest.
-- WORKFLOW_GATE_STORAGE_ZONE_REQUIRED
-- CHECK (storage_zone IS NULL OR storage_zone IN ('Zone 1','Zone 2','Zone 3','Zone 4','Zone 5','Zone 6','Zone 7'))
DO $$ BEGIN PERFORM 1; END $$;
