-- Create team_meetings table
CREATE TABLE public.team_meetings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID REFERENCES public.team_channels(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Team Meeting',
  room_code TEXT NOT NULL,
  started_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  meeting_type TEXT NOT NULL DEFAULT 'video'
);

-- Enable RLS
ALTER TABLE public.team_meetings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view meetings"
ON public.team_meetings FOR SELECT
USING (
  is_channel_member(auth.uid(), channel_id)
  OR has_any_role(auth.uid(), ARRAY['admin'::app_role])
);

CREATE POLICY "Members can start meetings"
ON public.team_meetings FOR INSERT
WITH CHECK (
  is_channel_member(auth.uid(), channel_id)
  AND started_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
);

CREATE POLICY "Creator can update meeting"
ON public.team_meetings FOR UPDATE
USING (
  started_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
  OR has_any_role(auth.uid(), ARRAY['admin'::app_role])
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_meetings;

-- Validation trigger
CREATE OR REPLACE FUNCTION public.validate_meeting_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('active', 'ended') THEN
    RAISE EXCEPTION 'Invalid meeting status: %', NEW.status;
  END IF;
  IF NEW.meeting_type NOT IN ('video', 'audio', 'screen_share') THEN
    RAISE EXCEPTION 'Invalid meeting type: %', NEW.meeting_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_meeting_status_trigger
BEFORE INSERT OR UPDATE ON public.team_meetings
FOR EACH ROW EXECUTE FUNCTION public.validate_meeting_status();
