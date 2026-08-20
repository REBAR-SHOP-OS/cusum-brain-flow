
-- Fix team_channels INSERT policy
DROP POLICY IF EXISTS "Users can create channels in their company" ON public.team_channels;
CREATE POLICY "Users can create channels in their company"
  ON public.team_channels FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.get_user_company_id(auth.uid())
    OR company_id IS NULL
    OR created_by = auth.uid()
  );

-- Add attachments column to team_messages
ALTER TABLE public.team_messages ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]';

-- Create team-chat-files storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('team-chat-files', 'team-chat-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies for team-chat-files
CREATE POLICY "Authenticated users can upload team chat files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'team-chat-files');

CREATE POLICY "Authenticated users can read team chat files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'team-chat-files');
