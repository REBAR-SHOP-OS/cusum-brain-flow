
-- 1. Add cut_plan_id to deliveries
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS cut_plan_id uuid REFERENCES public.cut_plans(id);

-- 2. Create packing_slips table
CREATE TABLE public.packing_slips (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  delivery_id uuid REFERENCES public.deliveries(id),
  cut_plan_id uuid REFERENCES public.cut_plans(id),
  slip_number text NOT NULL,
  customer_name text,
  ship_to text,
  items_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  signature_path text,
  site_photo_path text,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.packing_slips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view packing slips for their company"
  ON public.packing_slips FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert packing slips for their company"
  ON public.packing_slips FOR INSERT
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can update packing slips for their company"
  ON public.packing_slips FOR UPDATE
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete packing slips for their company"
  ON public.packing_slips FOR DELETE
  USING (company_id = public.get_user_company_id(auth.uid()));

-- Validate status
CREATE OR REPLACE FUNCTION public.validate_packing_slip_status()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('draft', 'delivered', 'archived') THEN
    RAISE EXCEPTION 'Invalid packing_slip status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_packing_slip_status_trigger
  BEFORE INSERT OR UPDATE ON public.packing_slips
  FOR EACH ROW EXECUTE FUNCTION public.validate_packing_slip_status();

-- Updated_at trigger
CREATE TRIGGER update_packing_slips_updated_at
  BEFORE UPDATE ON public.packing_slips
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
