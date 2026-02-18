
-- Create fix_tickets table for App Builder Screenshot-to-Fix engine
CREATE TABLE public.fix_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  reporter_user_id UUID NOT NULL,
  reporter_email TEXT,
  page_url TEXT,
  screenshot_url TEXT,
  repro_steps TEXT,
  expected_result TEXT,
  actual_result TEXT,
  severity TEXT NOT NULL DEFAULT 'medium',
  system_area TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  fix_output TEXT,
  fix_output_type TEXT,
  verification_steps TEXT,
  verification_result TEXT,
  verification_evidence TEXT,
  diagnosed_at TIMESTAMPTZ,
  fixed_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Validation trigger for severity, status, fix_output_type, verification_result
CREATE OR REPLACE FUNCTION public.validate_fix_ticket_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.severity NOT IN ('low', 'medium', 'high', 'critical') THEN
    RAISE EXCEPTION 'Invalid fix_ticket severity: %', NEW.severity;
  END IF;
  IF NEW.status NOT IN ('new', 'in_progress', 'fixed', 'blocked', 'verified', 'failed') THEN
    RAISE EXCEPTION 'Invalid fix_ticket status: %', NEW.status;
  END IF;
  IF NEW.fix_output_type IS NOT NULL AND NEW.fix_output_type NOT IN ('code_fix', 'lovable_prompt') THEN
    RAISE EXCEPTION 'Invalid fix_output_type: %', NEW.fix_output_type;
  END IF;
  IF NEW.verification_result IS NOT NULL AND NEW.verification_result NOT IN ('pass', 'fail') THEN
    RAISE EXCEPTION 'Invalid verification_result: %', NEW.verification_result;
  END IF;
  -- Enforce: cannot set status to 'fixed' without verification_result = 'pass'
  IF NEW.status = 'verified' AND NEW.verification_result IS DISTINCT FROM 'pass' THEN
    RAISE EXCEPTION 'Cannot mark ticket as verified without verification_result = pass';
  END IF;
  -- Auto-set timestamps
  IF NEW.status = 'fixed' AND OLD.status IS DISTINCT FROM 'fixed' THEN
    NEW.fixed_at := now();
  END IF;
  IF NEW.status = 'verified' AND OLD.status IS DISTINCT FROM 'verified' THEN
    NEW.verified_at := now();
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_fix_ticket
  BEFORE INSERT OR UPDATE ON public.fix_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_fix_ticket_fields();

-- Enable RLS
ALTER TABLE public.fix_tickets ENABLE ROW LEVEL SECURITY;

-- Admins: full CRUD
CREATE POLICY "Admins full access to fix_tickets"
  ON public.fix_tickets
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Reporters: read their own tickets
CREATE POLICY "Reporters can read own fix_tickets"
  ON public.fix_tickets
  FOR SELECT
  TO authenticated
  USING (reporter_user_id = auth.uid());

-- Reporters: can create tickets (insert)
CREATE POLICY "Authenticated users can create fix_tickets"
  ON public.fix_tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (reporter_user_id = auth.uid());

-- Index for common queries
CREATE INDEX idx_fix_tickets_company_status ON public.fix_tickets (company_id, status);
CREATE INDEX idx_fix_tickets_reporter ON public.fix_tickets (reporter_user_id);
