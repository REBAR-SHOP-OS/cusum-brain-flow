-- Add OCR verification columns to barlists
ALTER TABLE public.barlists
  ADD COLUMN IF NOT EXISTS ocr_confidence_score numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pending_review',
  ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_notes text,
  ADD COLUMN IF NOT EXISTS auto_approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS qa_flags jsonb DEFAULT '[]'::jsonb;

-- Validation trigger for verification_status
CREATE OR REPLACE FUNCTION public.validate_barlist_verification_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.verification_status NOT IN ('pending_review', 'auto_approved', 'human_approved', 'rejected', 'override') THEN
    RAISE EXCEPTION 'Invalid verification_status: %', NEW.verification_status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_barlist_verification_status_trigger
  BEFORE INSERT OR UPDATE ON public.barlists
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_barlist_verification_status();

-- Track how many barlists have been human-verified per project (for "first 10" rule)
CREATE TABLE IF NOT EXISTS public.ocr_verification_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  project_id uuid NOT NULL,
  human_verified_count integer NOT NULL DEFAULT 0,
  auto_approve_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, project_id)
);

ALTER TABLE public.ocr_verification_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company verification stats"
  ON public.ocr_verification_stats FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can update own company verification stats"
  ON public.ocr_verification_stats FOR UPDATE
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert own company verification stats"
  ON public.ocr_verification_stats FOR INSERT
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

-- Index for fast QA review queries
CREATE INDEX IF NOT EXISTS idx_barlists_verification_status ON public.barlists(verification_status);
CREATE INDEX IF NOT EXISTS idx_barlists_company_verification ON public.barlists(company_id, verification_status);