
-- Create machines table
CREATE TABLE public.machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  warehouse_id uuid NULL,
  name text NOT NULL,
  type text NOT NULL,
  status text NOT NULL DEFAULT 'idle',
  current_run_id uuid NULL REFERENCES public.machine_runs(id),
  current_operator_profile_id uuid NULL REFERENCES public.profiles(id),
  last_event_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Validation trigger for type and status
CREATE OR REPLACE FUNCTION public.validate_machine_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.type NOT IN ('cutter','bender','loader','other') THEN
    RAISE EXCEPTION 'Invalid machine type: %', NEW.type;
  END IF;
  IF NEW.status NOT IN ('idle','running','blocked','down') THEN
    RAISE EXCEPTION 'Invalid machine status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_machine_fields
BEFORE INSERT OR UPDATE ON public.machines
FOR EACH ROW EXECUTE FUNCTION public.validate_machine_fields();

-- Updated_at trigger
CREATE TRIGGER trg_machines_updated_at
BEFORE UPDATE ON public.machines
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Indexes
CREATE INDEX idx_machines_company_id ON public.machines(company_id);
CREATE INDEX idx_machines_warehouse_id ON public.machines(warehouse_id);
CREATE INDEX idx_machines_type ON public.machines(type);
CREATE INDEX idx_machines_status ON public.machines(status);

-- Enable RLS
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;

-- SELECT: any authenticated user in same company
CREATE POLICY "Users can view machines in their company"
ON public.machines FOR SELECT
TO authenticated
USING (company_id = get_user_company_id(auth.uid()));

-- INSERT: admin or workshop with company match
CREATE POLICY "Admins and workshop can insert machines"
ON public.machines FOR INSERT
TO authenticated
WITH CHECK (
  company_id = get_user_company_id(auth.uid())
  AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'workshop'::app_role])
);

-- UPDATE: admin or workshop with company match
CREATE POLICY "Admins and workshop can update machines"
ON public.machines FOR UPDATE
TO authenticated
USING (
  company_id = get_user_company_id(auth.uid())
  AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'workshop'::app_role])
);

-- DELETE: admin only
CREATE POLICY "Admins can delete machines"
ON public.machines FOR DELETE
TO authenticated
USING (
  company_id = get_user_company_id(auth.uid())
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Enable realtime for both machines and machine_runs
ALTER PUBLICATION supabase_realtime ADD TABLE public.machines;
ALTER PUBLICATION supabase_realtime ADD TABLE public.machine_runs;
