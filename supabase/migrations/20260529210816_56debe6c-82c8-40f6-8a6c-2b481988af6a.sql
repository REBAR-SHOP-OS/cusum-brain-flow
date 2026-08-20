-- Extend storage_zone allowed values from Zone 1-5 to Zone 1-7.
-- WORKFLOW_GATE_STORAGE_ZONE_REQUIRED marker kept so the regression test
-- in tests/regression/workflow-gate/ClearanceStorageZoneGate.test.ts
-- picks this migration as the latest.
ALTER TABLE public.clearance_evidence
  DROP CONSTRAINT IF EXISTS clearance_evidence_storage_zone_chk;

ALTER TABLE public.clearance_evidence
  ADD CONSTRAINT clearance_evidence_storage_zone_chk
  CHECK (storage_zone IS NULL OR storage_zone IN ('Zone 1','Zone 2','Zone 3','Zone 4','Zone 5','Zone 6','Zone 7'));

-- Re-declare the validator unchanged so the test still finds
-- WORKFLOW_GATE_STORAGE_ZONE_REQUIRED in the latest matching migration.
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
