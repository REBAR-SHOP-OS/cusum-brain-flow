
-- Recruitment Pipeline: Job Positions + Applicants

CREATE TABLE public.job_positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  title TEXT NOT NULL,
  department TEXT,
  location TEXT,
  employment_type TEXT NOT NULL DEFAULT 'full_time',
  description TEXT,
  requirements TEXT,
  salary_range_min NUMERIC,
  salary_range_max NUMERIC,
  status TEXT NOT NULL DEFAULT 'open',
  hiring_manager_id UUID REFERENCES public.profiles(id),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.job_applicants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  position_id UUID NOT NULL REFERENCES public.job_positions(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  resume_url TEXT,
  cover_letter TEXT,
  source TEXT DEFAULT 'direct',
  stage TEXT NOT NULL DEFAULT 'applied',
  rating INTEGER DEFAULT 0,
  notes TEXT,
  interview_date TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Validation triggers
CREATE OR REPLACE FUNCTION public.validate_job_position_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('draft', 'open', 'on_hold', 'closed', 'filled') THEN
    RAISE EXCEPTION 'Invalid job_position status: %', NEW.status;
  END IF;
  IF NEW.employment_type NOT IN ('full_time', 'part_time', 'contract', 'internship') THEN
    RAISE EXCEPTION 'Invalid employment_type: %', NEW.employment_type;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER validate_job_position BEFORE INSERT OR UPDATE ON public.job_positions
FOR EACH ROW EXECUTE FUNCTION public.validate_job_position_fields();

CREATE OR REPLACE FUNCTION public.validate_job_applicant_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.stage NOT IN ('applied', 'screening', 'phone_interview', 'technical_interview', 'final_interview', 'offer', 'hired', 'rejected') THEN
    RAISE EXCEPTION 'Invalid applicant stage: %', NEW.stage;
  END IF;
  IF NEW.rating < 0 OR NEW.rating > 5 THEN
    RAISE EXCEPTION 'Rating must be 0-5';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER validate_job_applicant BEFORE INSERT OR UPDATE ON public.job_applicants
FOR EACH ROW EXECUTE FUNCTION public.validate_job_applicant_fields();

-- Updated_at triggers
CREATE TRIGGER update_job_positions_updated_at BEFORE UPDATE ON public.job_positions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_job_applicants_updated_at BEFORE UPDATE ON public.job_applicants
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.job_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applicants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage job positions" ON public.job_positions FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Office can view job positions" ON public.job_positions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'office'::app_role) OR public.has_role(auth.uid(), 'sales'::app_role));

CREATE POLICY "Admin can manage applicants" ON public.job_applicants FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Office can view applicants" ON public.job_applicants FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'office'::app_role) OR public.has_role(auth.uid(), 'sales'::app_role));

-- Field audit trail
CREATE TRIGGER audit_job_positions_changes AFTER UPDATE ON public.job_positions
FOR EACH ROW EXECUTE FUNCTION public.track_field_changes();

CREATE TRIGGER audit_job_applicants_changes AFTER UPDATE ON public.job_applicants
FOR EACH ROW EXECUTE FUNCTION public.track_field_changes();
