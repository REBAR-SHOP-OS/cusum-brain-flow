CREATE TABLE public.vizzy_fix_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  photo_url TEXT,
  affected_area TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

ALTER TABLE public.vizzy_fix_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own fix requests"
  ON public.vizzy_fix_requests FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());