
-- #2: Manual verify reason + audit trail.
-- Additive: new optional column on clearance_evidence + trigger that logs
-- every transition to status='cleared' into activity_events (event_type='audit').
-- Does NOT change who can verify or any existing gate logic.

ALTER TABLE public.clearance_evidence
  ADD COLUMN IF NOT EXISTS override_reason text;

COMMENT ON COLUMN public.clearance_evidence.override_reason IS
'Optional free-text reason captured when an item is manually verified. Surfaced in audit log entries written by trg_log_clearance_verify_audit.';

CREATE OR REPLACE FUNCTION public.log_clearance_verify_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company_id uuid;
  _old_status text;
BEGIN
  -- Only fire when status becomes 'cleared'
  _old_status := COALESCE(OLD.status, NULL);
  IF NEW.status IS DISTINCT FROM 'cleared' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND _old_status = 'cleared' THEN
    RETURN NEW;
  END IF;

  -- Resolve company_id via cut_plan_items → cut_plans
  SELECT cp.company_id INTO _company_id
  FROM public.cut_plan_items cpi
  JOIN public.cut_plans cp ON cp.id = cpi.cut_plan_id
  WHERE cpi.id = NEW.cut_plan_item_id;

  IF _company_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.activity_events (
    company_id,
    entity_type,
    entity_id,
    event_type,
    description,
    source,
    actor_id,
    actor_type,
    metadata
  ) VALUES (
    _company_id,
    'cut_plan_item',
    NEW.cut_plan_item_id,
    'audit',
    'manual_verify_cleared',
    'manual_verify',
    NEW.verified_by,
    'user',
    jsonb_build_object(
      'audit_action', 'clearance_verify',
      'evidence_id', NEW.id,
      'before_status', _old_status,
      'after_status', NEW.status,
      'verification_method', NEW.verification_method,
      'verification_state', NEW.verification_state,
      'override_reason', NEW.override_reason,
      'tag_scan_url_present', NEW.tag_scan_url IS NOT NULL,
      'material_photo_url_present', NEW.material_photo_url IS NOT NULL,
      'verified_at', NEW.verified_at
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_clearance_verify_audit ON public.clearance_evidence;
CREATE TRIGGER trg_log_clearance_verify_audit
AFTER INSERT OR UPDATE OF status ON public.clearance_evidence
FOR EACH ROW
EXECUTE FUNCTION public.log_clearance_verify_audit();
