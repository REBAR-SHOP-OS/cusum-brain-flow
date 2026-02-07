
-- 1. Add company_id to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS company_id uuid NULL;

-- 2. Create machine_runs table
CREATE TABLE public.machine_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  work_order_id uuid NULL REFERENCES public.work_orders(id),
  machine_id uuid NOT NULL,
  operator_profile_id uuid NULL REFERENCES public.profiles(id),
  supervisor_profile_id uuid NULL REFERENCES public.profiles(id),
  process text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  started_at timestamptz NULL,
  ended_at timestamptz NULL,
  duration_seconds int GENERATED ALWAYS AS (
    CASE
      WHEN started_at IS NOT NULL AND ended_at IS NOT NULL
      THEN GREATEST(0, EXTRACT(EPOCH FROM (ended_at - started_at))::int)
      ELSE NULL
    END
  ) STORED,
  input_qty numeric NULL,
  output_qty numeric NULL,
  scrap_qty numeric NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Add validation trigger for process field (instead of CHECK for immutability safety)
CREATE OR REPLACE FUNCTION public.validate_machine_run_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.process NOT IN ('cut','bend','load','pickup','delivery','clearance','other') THEN
    RAISE EXCEPTION 'Invalid process value: %', NEW.process;
  END IF;
  IF NEW.status NOT IN ('queued','running','paused','blocked','completed','rejected','canceled') THEN
    RAISE EXCEPTION 'Invalid status value: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_machine_run_fields_trigger
  BEFORE INSERT OR UPDATE ON public.machine_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_machine_run_fields();

-- 4. Updated_at trigger
CREATE TRIGGER update_machine_runs_updated_at
  BEFORE UPDATE ON public.machine_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Indexes
CREATE INDEX idx_machine_runs_company_id ON public.machine_runs(company_id);
CREATE INDEX idx_machine_runs_work_order_id ON public.machine_runs(work_order_id);
CREATE INDEX idx_machine_runs_machine_id ON public.machine_runs(machine_id);
CREATE INDEX idx_machine_runs_status ON public.machine_runs(status);
CREATE INDEX idx_machine_runs_started_at ON public.machine_runs(started_at);

-- 6. Enable RLS
ALTER TABLE public.machine_runs ENABLE ROW LEVEL SECURITY;

-- 7. Helper function: get company_id for the current user
CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE user_id = _user_id LIMIT 1;
$$;

-- 8. RLS Policies

-- SELECT: any authenticated user whose profile.company_id matches
CREATE POLICY "Users can view machine_runs in their company"
  ON public.machine_runs
  FOR SELECT
  USING (
    company_id = public.get_user_company_id(auth.uid())
  );

-- INSERT: admin (owner) or workshop (supervisor) with company match
CREATE POLICY "Admins and workshop can insert machine_runs"
  ON public.machine_runs
  FOR INSERT
  WITH CHECK (
    company_id = public.get_user_company_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'workshop'::app_role])
  );

-- UPDATE: admin (owner) or workshop (supervisor) with company match
CREATE POLICY "Admins and workshop can update machine_runs"
  ON public.machine_runs
  FOR UPDATE
  USING (
    company_id = public.get_user_company_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'workshop'::app_role])
  );

-- DELETE: admin only with company match
CREATE POLICY "Admins can delete machine_runs"
  ON public.machine_runs
  FOR DELETE
  USING (
    company_id = public.get_user_company_id(auth.uid())
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

-- 9. Index on profiles.company_id for the helper function
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON public.profiles(company_id);
