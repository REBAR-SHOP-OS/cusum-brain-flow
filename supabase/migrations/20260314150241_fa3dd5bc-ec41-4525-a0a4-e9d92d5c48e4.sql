
-- Camera events table for production visibility + dispatch intelligence
CREATE TABLE public.camera_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  event_type text NOT NULL,
  camera_id text,
  zone text,
  detected_class text,
  confidence numeric,
  related_machine_id uuid REFERENCES public.machines(id),
  related_order_id uuid REFERENCES public.work_orders(id),
  related_delivery_id uuid,
  snapshot_url text,
  recommended_action text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Index for company-scoped queries
CREATE INDEX idx_camera_events_company ON public.camera_events(company_id, created_at DESC);
CREATE INDEX idx_camera_events_type ON public.camera_events(event_type);

-- RLS
ALTER TABLE public.camera_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own company camera events"
  ON public.camera_events FOR SELECT TO authenticated
  USING (
    company_id IN (
      SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Service can insert camera events"
  ON public.camera_events FOR INSERT TO authenticated
  WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.camera_events;
