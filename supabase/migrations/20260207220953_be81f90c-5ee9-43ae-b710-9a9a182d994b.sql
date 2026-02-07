
-- Add AI notes/summary columns to team_meetings
ALTER TABLE public.team_meetings
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS ai_summary TEXT,
  ADD COLUMN IF NOT EXISTS participants TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;

-- Add index for daily digest queries
CREATE INDEX IF NOT EXISTS idx_team_meetings_started_at ON public.team_meetings(started_at);
CREATE INDEX IF NOT EXISTS idx_team_meetings_status ON public.team_meetings(status);
