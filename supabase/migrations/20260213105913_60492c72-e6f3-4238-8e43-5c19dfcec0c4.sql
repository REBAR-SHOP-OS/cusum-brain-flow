
-- Transcription sessions table for persistence
CREATE TABLE public.transcription_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id),
  title TEXT NOT NULL DEFAULT 'Untitled Session',
  raw_transcript TEXT NOT NULL DEFAULT '',
  processed_output TEXT,
  process_type TEXT DEFAULT 'transcribe',
  source_language TEXT,
  target_language TEXT,
  duration_seconds INTEGER,
  speaker_count INTEGER DEFAULT 1,
  company_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.transcription_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own transcription sessions"
  ON public.transcription_sessions FOR SELECT
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users create own transcription sessions"
  ON public.transcription_sessions FOR INSERT
  WITH CHECK (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users update own transcription sessions"
  ON public.transcription_sessions FOR UPDATE
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users delete own transcription sessions"
  ON public.transcription_sessions FOR DELETE
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins see all transcription sessions"
  ON public.transcription_sessions FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_transcription_sessions_updated_at
  BEFORE UPDATE ON public.transcription_sessions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
