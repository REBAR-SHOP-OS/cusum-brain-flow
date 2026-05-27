ALTER TABLE public.clearance_evidence
  ADD COLUMN IF NOT EXISTS verification_method text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS verification_state  text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS ai_confidence       numeric,
  ADD COLUMN IF NOT EXISTS ocr_metadata        jsonb;

ALTER TABLE public.clearance_evidence
  DROP CONSTRAINT IF EXISTS clearance_evidence_verification_method_chk;
ALTER TABLE public.clearance_evidence
  ADD CONSTRAINT clearance_evidence_verification_method_chk
  CHECK (verification_method IN ('manual','assisted','auto'));

ALTER TABLE public.clearance_evidence
  DROP CONSTRAINT IF EXISTS clearance_evidence_verification_state_chk;
ALTER TABLE public.clearance_evidence
  ADD CONSTRAINT clearance_evidence_verification_state_chk
  CHECK (verification_state IN ('pending','tag_scanned','product_captured','ai_verified','manual_review','complete'));