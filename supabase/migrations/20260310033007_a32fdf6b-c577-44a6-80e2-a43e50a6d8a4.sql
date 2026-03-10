
CREATE TABLE public.cut_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  source_plan_id uuid,
  machine_id uuid REFERENCES public.machines(id),
  machine_run_id uuid,
  cut_plan_item_id uuid,
  bar_code text,
  planned_qty integer,
  actual_qty integer,
  scrap_qty integer DEFAULT 0,
  variance integer GENERATED ALWAYS AS (actual_qty - planned_qty) STORED,
  status text DEFAULT 'completed',
  notes text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.cut_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members can view cut_batches" ON public.cut_batches
  FOR SELECT TO authenticated USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "Company members can insert cut_batches" ON public.cut_batches
  FOR INSERT TO authenticated WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));
CREATE INDEX idx_cut_batches_machine ON public.cut_batches(machine_id);
CREATE INDEX idx_cut_batches_plan_item ON public.cut_batches(cut_plan_item_id);
