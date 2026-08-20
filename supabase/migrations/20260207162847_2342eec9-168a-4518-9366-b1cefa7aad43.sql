
-- System learnings table for Foreman Brain learning loop
CREATE TABLE public.system_learnings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id TEXT NOT NULL DEFAULT '',
  module TEXT NOT NULL,  -- 'cut', 'bend', 'spiral', 'inventory', 'queue'
  learning_type TEXT NOT NULL DEFAULT 'success',  -- 'success', 'blocker', 'error', 'exception', 'edge_case'
  event_type TEXT NOT NULL,  -- e.g. 'remnant_substitution', 'shortage_mid_run', 'wrong_stock', etc.
  context JSONB NOT NULL DEFAULT '{}',
  resolution TEXT,
  weight_adjustment NUMERIC DEFAULT 0,
  machine_id UUID REFERENCES public.machines(id),
  bar_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.system_learnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read learnings"
  ON public.system_learnings FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert learnings"
  ON public.system_learnings FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Index for fast lookups by module + event_type
CREATE INDEX idx_system_learnings_module ON public.system_learnings(module, event_type);
CREATE INDEX idx_system_learnings_created ON public.system_learnings(created_at DESC);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_learnings;
