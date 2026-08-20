
-- Phase 3 Migration 1: bend_batches table
CREATE TABLE public.bend_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  source_cut_batch_id uuid REFERENCES public.cut_batches(id),
  source_job_id uuid,
  machine_id uuid REFERENCES public.machines(id),
  bend_pattern text,
  shape text,
  size text,
  planned_qty integer NOT NULL DEFAULT 0,
  actual_qty integer DEFAULT 0,
  variance integer GENERATED ALWAYS AS (actual_qty - planned_qty) STORED,
  status text NOT NULL DEFAULT 'queued',
  assigned_operator uuid,
  notes text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.bend_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view bend_batches" ON public.bend_batches
  FOR SELECT TO authenticated USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "Company members can insert bend_batches" ON public.bend_batches
  FOR INSERT TO authenticated WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "Company members can update bend_batches" ON public.bend_batches
  FOR UPDATE TO authenticated USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

CREATE INDEX idx_bend_batches_company ON public.bend_batches(company_id);
CREATE INDEX idx_bend_batches_cut_batch ON public.bend_batches(source_cut_batch_id);
CREATE INDEX idx_bend_batches_status ON public.bend_batches(status);

-- Unique index to prevent duplicate bend_batch for same source_cut_batch
CREATE UNIQUE INDEX idx_bend_batches_dedup ON public.bend_batches(source_cut_batch_id) WHERE status NOT IN ('cancelled');
