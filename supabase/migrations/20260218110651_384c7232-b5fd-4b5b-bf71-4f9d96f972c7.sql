
-- Inventory Count / Stock Adjustment workflow
CREATE TABLE public.inventory_counts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  count_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  count_type TEXT NOT NULL DEFAULT 'full', -- full, cycle, spot
  location TEXT, -- optional warehouse location
  counted_by UUID,
  approved_by UUID,
  count_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.inventory_count_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  count_id UUID NOT NULL REFERENCES public.inventory_counts(id) ON DELETE CASCADE,
  bar_code TEXT NOT NULL REFERENCES public.rebar_sizes(bar_code),
  expected_qty INTEGER NOT NULL DEFAULT 0,
  counted_qty INTEGER,
  variance INTEGER GENERATED ALWAYS AS (COALESCE(counted_qty, 0) - expected_qty) STORED,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inventory_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_count_lines ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "ic_select" ON public.inventory_counts FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "ic_insert" ON public.inventory_counts FOR INSERT
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "ic_update" ON public.inventory_counts FOR UPDATE
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "ic_delete" ON public.inventory_counts FOR DELETE
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "icl_select" ON public.inventory_count_lines FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.inventory_counts ic WHERE ic.id = count_id AND ic.company_id = public.get_user_company_id(auth.uid())));
CREATE POLICY "icl_insert" ON public.inventory_count_lines FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.inventory_counts ic WHERE ic.id = count_id AND ic.company_id = public.get_user_company_id(auth.uid())));
CREATE POLICY "icl_update" ON public.inventory_count_lines FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.inventory_counts ic WHERE ic.id = count_id AND ic.company_id = public.get_user_company_id(auth.uid())));
CREATE POLICY "icl_delete" ON public.inventory_count_lines FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.inventory_counts ic WHERE ic.id = count_id AND ic.company_id = public.get_user_company_id(auth.uid())));

-- Indexes
CREATE INDEX idx_ic_company_status ON public.inventory_counts (company_id, status);
CREATE INDEX idx_icl_count_id ON public.inventory_count_lines (count_id);

-- Updated_at trigger
CREATE TRIGGER update_inventory_counts_updated_at
  BEFORE UPDATE ON public.inventory_counts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Validation
CREATE OR REPLACE FUNCTION public.validate_inventory_count_fields()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status NOT IN ('draft', 'in_progress', 'completed', 'approved', 'canceled') THEN
    RAISE EXCEPTION 'Invalid inventory_count status: %', NEW.status;
  END IF;
  IF NEW.count_type NOT IN ('full', 'cycle', 'spot') THEN
    RAISE EXCEPTION 'Invalid count_type: %', NEW.count_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_inventory_count_fields_trigger
  BEFORE INSERT OR UPDATE ON public.inventory_counts
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_inventory_count_fields();

-- Audit trail
CREATE TRIGGER track_inventory_counts_field_changes
  AFTER UPDATE ON public.inventory_counts
  FOR EACH ROW
  EXECUTE FUNCTION public.track_field_changes();
