
-- Time clock entries for employee clock-in/clock-out
CREATE TABLE public.time_clock_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  clock_in TIMESTAMPTZ NOT NULL DEFAULT now(),
  clock_out TIMESTAMPTZ,
  break_minutes INT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.time_clock_entries ENABLE ROW LEVEL SECURITY;

-- Policies: all authenticated users can view, users can manage their own
CREATE POLICY "Authenticated users can view all clock entries"
  ON public.time_clock_entries FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert their own clock entries"
  ON public.time_clock_entries FOR INSERT
  WITH CHECK (
    profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update their own clock entries"
  ON public.time_clock_entries FOR UPDATE
  USING (
    profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- Admins can manage all entries
CREATE POLICY "Admins can manage all clock entries"
  ON public.time_clock_entries FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Index for quick lookups
CREATE INDEX idx_time_clock_profile ON public.time_clock_entries(profile_id, clock_in DESC);

-- Enable realtime for live status updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.time_clock_entries;
