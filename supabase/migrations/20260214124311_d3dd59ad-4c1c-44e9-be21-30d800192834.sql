
-- Vizzy persistent memory table
CREATE TABLE public.vizzy_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'general',
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  company_id UUID NOT NULL
);

-- Enable RLS
ALTER TABLE public.vizzy_memory ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own memories
CREATE POLICY "Users manage own memories"
  ON public.vizzy_memory FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Index for fast lookup
CREATE INDEX idx_vizzy_memory_user ON public.vizzy_memory(user_id, created_at DESC);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.vizzy_memory;
