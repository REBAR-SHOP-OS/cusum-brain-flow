
-- Phase 3 Migration 2: bundles table
CREATE TABLE public.bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  source_job_id uuid,
  source_bend_batch_id uuid REFERENCES public.bend_batches(id),
  source_cut_batch_id uuid REFERENCES public.cut_batches(id),
  size text,
  shape text,
  quantity integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'created',
  bundle_code text,
  notes text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.bundles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view bundles" ON public.bundles
  FOR SELECT TO authenticated USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "Company members can insert bundles" ON public.bundles
  FOR INSERT TO authenticated WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "Company members can update bundles" ON public.bundles
  FOR UPDATE TO authenticated USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

CREATE INDEX idx_bundles_company ON public.bundles(company_id);
CREATE INDEX idx_bundles_bend_batch ON public.bundles(source_bend_batch_id);
CREATE INDEX idx_bundles_status ON public.bundles(status);

-- Unique index to prevent duplicate bundle for same bend_batch
CREATE UNIQUE INDEX idx_bundles_dedup ON public.bundles(source_bend_batch_id) WHERE status NOT IN ('cancelled');
