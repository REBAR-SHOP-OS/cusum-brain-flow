
CREATE TABLE public.waste_bank_pieces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  bar_code text NOT NULL,
  length_mm integer NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  source_job_id uuid,
  source_batch_id uuid REFERENCES public.cut_batches(id),
  source_machine_id uuid REFERENCES public.machines(id),
  status text NOT NULL DEFAULT 'available',
  location text,
  reserved_by uuid,
  reserved_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.waste_bank_pieces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members can view waste_bank" ON public.waste_bank_pieces
  FOR SELECT TO authenticated USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "Company members can insert waste_bank" ON public.waste_bank_pieces
  FOR INSERT TO authenticated WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "Company members can update waste_bank" ON public.waste_bank_pieces
  FOR UPDATE TO authenticated USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));
CREATE INDEX idx_waste_bank_status ON public.waste_bank_pieces(status, bar_code);
