
-- Table to store Vizzy voice interaction transcripts
CREATE TABLE public.vizzy_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  transcript JSONB NOT NULL DEFAULT '[]'::jsonb,
  session_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  session_ended_at TIMESTAMPTZ,
  context_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table for daily journals generated from interactions
CREATE TABLE public.vizzy_journals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  journal_date DATE NOT NULL DEFAULT CURRENT_DATE,
  content TEXT NOT NULL,
  interaction_count INT NOT NULL DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, journal_date)
);

-- Enable RLS
ALTER TABLE public.vizzy_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vizzy_journals ENABLE ROW LEVEL SECURITY;

-- RLS: Users can only access their own interactions
CREATE POLICY "Users can view own interactions" ON public.vizzy_interactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own interactions" ON public.vizzy_interactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own interactions" ON public.vizzy_interactions FOR UPDATE USING (auth.uid() = user_id);

-- RLS: Users can only access their own journals
CREATE POLICY "Users can view own journals" ON public.vizzy_journals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own journals" ON public.vizzy_journals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own journals" ON public.vizzy_journals FOR UPDATE USING (auth.uid() = user_id);

-- Service role can manage journals (for edge function generation)
CREATE POLICY "Service can manage interactions" ON public.vizzy_interactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service can manage journals" ON public.vizzy_journals FOR ALL USING (true) WITH CHECK (true);
