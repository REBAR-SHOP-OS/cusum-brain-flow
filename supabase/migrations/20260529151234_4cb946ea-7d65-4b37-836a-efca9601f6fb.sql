-- A8 Storage Zone: Clearance is not complete until a storage zone is assigned.
-- Surgical, additive: storage_zone column on clearance_evidence + gate + audit.

-- 1) Add nullable storage_zone column (Zone 1-5)
ALTER TABLE public.clearance_evidence
  ADD COLUMN IF NOT EXISTS storage_zone TEXT;

ALTER TABLE public.clearance_evidence
  DROP CONSTRAINT IF EXISTS clearance_evidence_storage_zone_chk;

ALTER TABLE public.clearance_evidence
  ADD CONSTRAINT clearance_evidence_storage_zone_chk
  CHECK (storage_zone IS NULL OR storage_zone IN ('Zone 1','Zone 2','Zone 3','Zone 4','Zone 5'));

-- 2) Extend the clearance evidence transition validator to require storage_zone
--    when flipping status to 'cleared'. Override flag still bypasses (supervisor).
CREATE OR REPLACE FUNCTION public.validate_clearance_evidence_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    -- A8: storage zone is required for clearance to be considered complete.
    IF NEW.storage_zone IS NULL OR btrim(NEW.storage_zone) = '' THEN
      RAISE EXCEPTION 'WORKFLOW_GATE_STORAGE_ZONE_REQUIRED: storage zone must be assigned before clearance is complete' USING ERRCODE='P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 3) Audit event whenever storage_zone is assigned or changed.
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