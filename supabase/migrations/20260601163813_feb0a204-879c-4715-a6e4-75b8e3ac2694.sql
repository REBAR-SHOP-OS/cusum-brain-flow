-- Clearance strict matching: add Ref field + OCR/match evidence columns
-- Additive only — does not touch existing data.

-- 1. Add ref_no to cut_plan_items (third matching field alongside mark_number + drawing_ref)
ALTER TABLE public.cut_plan_items
  ADD COLUMN IF NOT EXISTS ref_no text;

COMMENT ON COLUMN public.cut_plan_items.ref_no IS
  'Tag "Ref" field — third mandatory identifier for Clearance auto-match (MARK + DWG + Ref).';

-- 2. Extend clearance_evidence with OCR + matched + mismatch tracking
ALTER TABLE public.clearance_evidence
  ADD COLUMN IF NOT EXISTS ocr_mark text,
  ADD COLUMN IF NOT EXISTS ocr_dwg text,
  ADD COLUMN IF NOT EXISTS ocr_ref text,
  ADD COLUMN IF NOT EXISTS matched_mark text,
  ADD COLUMN IF NOT EXISTS matched_dwg text,
  ADD COLUMN IF NOT EXISTS matched_ref text,
  ADD COLUMN IF NOT EXISTS match_confidence numeric,
  ADD COLUMN IF NOT EXISTS mismatch_reason text;

COMMENT ON COLUMN public.clearance_evidence.ocr_mark IS 'OCR-extracted MARK from tag photo.';
COMMENT ON COLUMN public.clearance_evidence.ocr_dwg  IS 'OCR-extracted DWG from tag photo.';
COMMENT ON COLUMN public.clearance_evidence.ocr_ref  IS 'OCR-extracted Ref from tag photo.';
COMMENT ON COLUMN public.clearance_evidence.matched_mark IS 'System MARK that matched at auto/assisted decision time.';
COMMENT ON COLUMN public.clearance_evidence.matched_dwg  IS 'System DWG that matched at auto/assisted decision time.';
COMMENT ON COLUMN public.clearance_evidence.matched_ref  IS 'System Ref that matched at auto/assisted decision time.';
COMMENT ON COLUMN public.clearance_evidence.match_confidence IS 'Per-row tag match confidence (0..1).';
COMMENT ON COLUMN public.clearance_evidence.mismatch_reason  IS 'Human-readable mismatch reason when auto-match was blocked.';
