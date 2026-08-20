
CREATE TABLE public.production_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  session_id uuid,
  job_id uuid,
  row_id uuid,
  machine_id uuid,
  batch_id uuid,
  event_type text NOT NULL,
  old_status text,
  new_status text,
  triggered_by uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.production_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members can view production events" ON public.production_events
  FOR SELECT TO authenticated USING (
    company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
  );
CREATE POLICY "Company members can insert production events" ON public.production_events
  FOR INSERT TO authenticated WITH CHECK (
    company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
  );
CREATE INDEX idx_production_events_session ON public.production_events(session_id);
CREATE INDEX idx_production_events_type ON public.production_events(event_type);
CREATE INDEX idx_production_events_company ON public.production_events(company_id);
