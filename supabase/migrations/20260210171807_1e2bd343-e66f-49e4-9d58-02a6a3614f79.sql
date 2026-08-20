
-- Extend team_meetings table
ALTER TABLE public.team_meetings 
  ADD COLUMN IF NOT EXISTS recording_url text,
  ADD COLUMN IF NOT EXISTS transcript jsonb,
  ADD COLUMN IF NOT EXISTS structured_report jsonb,
  ADD COLUMN IF NOT EXISTS is_external boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_settings jsonb NOT NULL DEFAULT '{}';

-- Create meeting_transcript_entries table
CREATE TABLE public.meeting_transcript_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.team_meetings(id) ON DELETE CASCADE,
  speaker_name text NOT NULL,
  speaker_profile_id uuid REFERENCES public.profiles(id),
  text text NOT NULL,
  timestamp_ms integer NOT NULL DEFAULT 0,
  is_final boolean NOT NULL DEFAULT true,
  language text NOT NULL DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.meeting_transcript_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read transcript entries"
  ON public.meeting_transcript_entries FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert transcript entries"
  ON public.meeting_transcript_entries FOR INSERT TO authenticated
  WITH CHECK (true);

-- Create meeting_action_items table
CREATE TABLE public.meeting_action_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.team_meetings(id) ON DELETE CASCADE,
  title text NOT NULL,
  assignee_name text,
  assignee_profile_id uuid REFERENCES public.profiles(id),
  due_date date,
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'draft',
  confidence numeric DEFAULT 0.5,
  company_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.meeting_action_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read action items"
  ON public.meeting_action_items FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert action items"
  ON public.meeting_action_items FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update action items"
  ON public.meeting_action_items FOR UPDATE TO authenticated
  USING (true);

-- Validate priority and status
CREATE OR REPLACE FUNCTION public.validate_meeting_action_item()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.priority NOT IN ('low', 'medium', 'high') THEN
    RAISE EXCEPTION 'Invalid priority: %', NEW.priority;
  END IF;
  IF NEW.status NOT IN ('draft', 'approved', 'completed', 'dismissed') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_meeting_action_item_trigger
  BEFORE INSERT OR UPDATE ON public.meeting_action_items
  FOR EACH ROW EXECUTE FUNCTION public.validate_meeting_action_item();

-- Create meeting-recordings storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('meeting-recordings', 'meeting-recordings', false);

CREATE POLICY "Authenticated users can upload meeting recordings"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'meeting-recordings');

CREATE POLICY "Authenticated users can read meeting recordings"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'meeting-recordings');

-- Enable realtime on transcript entries
ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_transcript_entries;

-- Index for fast transcript lookups
CREATE INDEX idx_transcript_entries_meeting ON public.meeting_transcript_entries(meeting_id, created_at);
CREATE INDEX idx_action_items_meeting ON public.meeting_action_items(meeting_id);
CREATE INDEX idx_action_items_status ON public.meeting_action_items(status);
