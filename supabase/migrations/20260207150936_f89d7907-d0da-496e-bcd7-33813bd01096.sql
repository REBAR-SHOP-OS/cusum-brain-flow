
-- =============================================================
-- INVENTORY CONSUMPTION SYSTEM
-- =============================================================

-- 1) inventory_lots: raw stock + remnants
CREATE TABLE public.inventory_lots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  bar_code TEXT NOT NULL REFERENCES public.rebar_sizes(bar_code),
  lot_number TEXT,
  source TEXT NOT NULL DEFAULT 'purchase' CHECK (source IN ('purchase','remnant','transfer')),
  standard_length_mm INTEGER NOT NULL DEFAULT 12000,
  qty_on_hand INTEGER NOT NULL DEFAULT 0,
  qty_reserved INTEGER NOT NULL DEFAULT 0,
  location TEXT DEFAULT 'yard',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_lots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view inventory in their company" ON public.inventory_lots
  FOR SELECT USING (
    company_id = public.get_user_company_id(auth.uid())
  );

CREATE POLICY "Admin/workshop can insert inventory" ON public.inventory_lots
  FOR INSERT WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['admin','workshop']::app_role[])
    AND company_id = public.get_user_company_id(auth.uid())
  );

CREATE POLICY "Admin/workshop can update inventory" ON public.inventory_lots
  FOR UPDATE USING (
    public.has_any_role(auth.uid(), ARRAY['admin','workshop']::app_role[])
    AND company_id = public.get_user_company_id(auth.uid())
  );

-- 2) floor_stock: loose bars on the shop floor (not tracked by lot)
CREATE TABLE public.floor_stock (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  bar_code TEXT NOT NULL REFERENCES public.rebar_sizes(bar_code),
  length_mm INTEGER NOT NULL DEFAULT 12000,
  qty_on_hand INTEGER NOT NULL DEFAULT 0,
  qty_reserved INTEGER NOT NULL DEFAULT 0,
  machine_id UUID REFERENCES public.machines(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.floor_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view floor stock in company" ON public.floor_stock
  FOR SELECT USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Admin/workshop can manage floor stock" ON public.floor_stock
  FOR ALL USING (
    public.has_any_role(auth.uid(), ARRAY['admin','workshop']::app_role[])
    AND company_id = public.get_user_company_id(auth.uid())
  );

-- 3) cut_output_batches: WIP output from cut runs (feeds benders)
CREATE TABLE public.cut_output_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  machine_run_id UUID REFERENCES public.machine_runs(id),
  cut_plan_item_id UUID REFERENCES public.cut_plan_items(id),
  bar_code TEXT NOT NULL REFERENCES public.rebar_sizes(bar_code),
  cut_length_mm INTEGER NOT NULL,
  qty_produced INTEGER NOT NULL DEFAULT 0,
  qty_available INTEGER NOT NULL DEFAULT 0,
  qty_consumed INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','partial','consumed','scrapped')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cut_output_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view cut output in company" ON public.cut_output_batches
  FOR SELECT USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Admin/workshop can manage cut output" ON public.cut_output_batches
  FOR ALL USING (
    public.has_any_role(auth.uid(), ARRAY['admin','workshop']::app_role[])
    AND company_id = public.get_user_company_id(auth.uid())
  );

-- 4) inventory_reservations: tracks what's reserved for which plan/item
CREATE TABLE public.inventory_reservations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  cut_plan_id UUID REFERENCES public.cut_plans(id),
  cut_plan_item_id UUID REFERENCES public.cut_plan_items(id),
  source_type TEXT NOT NULL CHECK (source_type IN ('lot','remnant','floor','wip')),
  source_id UUID NOT NULL,
  bar_code TEXT NOT NULL REFERENCES public.rebar_sizes(bar_code),
  qty_reserved INTEGER NOT NULL DEFAULT 0,
  qty_consumed INTEGER NOT NULL DEFAULT 0,
  stock_length_mm INTEGER NOT NULL DEFAULT 12000,
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','consumed','released','partial')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reservations in company" ON public.inventory_reservations
  FOR SELECT USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Admin/workshop can manage reservations" ON public.inventory_reservations
  FOR ALL USING (
    public.has_any_role(auth.uid(), ARRAY['admin','workshop']::app_role[])
    AND company_id = public.get_user_company_id(auth.uid())
  );

-- 5) inventory_scrap: records scrap pieces < remnant threshold
CREATE TABLE public.inventory_scrap (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  machine_run_id UUID REFERENCES public.machine_runs(id),
  bar_code TEXT NOT NULL REFERENCES public.rebar_sizes(bar_code),
  length_mm INTEGER NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  reason TEXT DEFAULT 'cutoff_below_threshold',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_scrap ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view scrap in company" ON public.inventory_scrap
  FOR SELECT USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Admin/workshop can insert scrap" ON public.inventory_scrap
  FOR INSERT WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['admin','workshop']::app_role[])
    AND company_id = public.get_user_company_id(auth.uid())
  );

-- Indexes for performance
CREATE INDEX idx_inventory_lots_company_bar ON public.inventory_lots(company_id, bar_code);
CREATE INDEX idx_floor_stock_company_bar ON public.floor_stock(company_id, bar_code);
CREATE INDEX idx_cut_output_company_bar ON public.cut_output_batches(company_id, bar_code);
CREATE INDEX idx_reservations_plan ON public.inventory_reservations(cut_plan_id);
CREATE INDEX idx_reservations_source ON public.inventory_reservations(source_type, source_id);
CREATE INDEX idx_inventory_scrap_company ON public.inventory_scrap(company_id);

-- Updated_at triggers
CREATE TRIGGER update_inventory_lots_updated_at
  BEFORE UPDATE ON public.inventory_lots
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_floor_stock_updated_at
  BEFORE UPDATE ON public.floor_stock
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_cut_output_updated_at
  BEFORE UPDATE ON public.cut_output_batches
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_reservations_updated_at
  BEFORE UPDATE ON public.inventory_reservations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Enable realtime for live station updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_reservations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cut_output_batches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_lots;
