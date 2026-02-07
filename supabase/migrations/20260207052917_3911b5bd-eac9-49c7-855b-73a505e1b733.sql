
-- Create machine_capabilities junction table
CREATE TABLE public.machine_capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  bar_code text NOT NULL REFERENCES public.rebar_sizes(bar_code),
  bar_mm numeric NULL,  -- legacy/debug only, NOT used for validation
  process text NOT NULL,  -- 'cut', 'bend', 'load', 'other'
  max_length_mm numeric NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(machine_id, bar_code, process)
);

-- Indexes
CREATE INDEX idx_machine_capabilities_machine_id ON public.machine_capabilities(machine_id);
CREATE INDEX idx_machine_capabilities_bar_code ON public.machine_capabilities(bar_code);
CREATE INDEX idx_machine_capabilities_process ON public.machine_capabilities(process);

-- Updated_at trigger
CREATE TRIGGER update_machine_capabilities_updated_at
  BEFORE UPDATE ON public.machine_capabilities
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Validation trigger: enforce bar_code is set and valid, bar_mm is informational only
CREATE OR REPLACE FUNCTION public.validate_machine_capability()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  -- bar_code is the source of truth, must exist in rebar_sizes (FK handles this)
  -- If bar_mm is provided, auto-populate from rebar_sizes for consistency
  IF NEW.bar_mm IS NULL THEN
    SELECT diameter_mm INTO NEW.bar_mm FROM public.rebar_sizes WHERE bar_code = NEW.bar_code;
  END IF;

  -- Validate process
  IF NEW.process NOT IN ('cut','bend','load','other') THEN
    RAISE EXCEPTION 'Invalid process: %. Must be cut, bend, load, or other.', NEW.process;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_machine_capability_trigger
  BEFORE INSERT OR UPDATE ON public.machine_capabilities
  FOR EACH ROW EXECUTE FUNCTION public.validate_machine_capability();

-- RLS
ALTER TABLE public.machine_capabilities ENABLE ROW LEVEL SECURITY;

-- SELECT: same company users can view
CREATE POLICY "Users can view capabilities in their company"
  ON public.machine_capabilities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.machines m
      WHERE m.id = machine_capabilities.machine_id
        AND m.company_id = get_user_company_id(auth.uid())
    )
  );

-- INSERT/UPDATE: admin and workshop only
CREATE POLICY "Admins and workshop can insert capabilities"
  ON public.machine_capabilities FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.machines m
      WHERE m.id = machine_capabilities.machine_id
        AND m.company_id = get_user_company_id(auth.uid())
    )
    AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'workshop'::app_role])
  );

CREATE POLICY "Admins and workshop can update capabilities"
  ON public.machine_capabilities FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.machines m
      WHERE m.id = machine_capabilities.machine_id
        AND m.company_id = get_user_company_id(auth.uid())
    )
    AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'workshop'::app_role])
  );

-- DELETE: admin only
CREATE POLICY "Admins can delete capabilities"
  ON public.machine_capabilities FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.machines m
      WHERE m.id = machine_capabilities.machine_id
        AND m.company_id = get_user_company_id(auth.uid())
    )
    AND has_role(auth.uid(), 'admin'::app_role)
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.machine_capabilities;
