
-- Add preferred_language to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_language text NOT NULL DEFAULT 'en';

-- Team channels (general, project-specific, etc.)
CREATE TABLE public.team_channels (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  channel_type text NOT NULL DEFAULT 'group', -- 'group' or 'dm'
  company_id uuid,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Channel members
CREATE TABLE public.team_channel_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id uuid NOT NULL REFERENCES public.team_channels(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(channel_id, profile_id)
);

-- Team messages with translation support
CREATE TABLE public.team_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id uuid NOT NULL REFERENCES public.team_channels(id) ON DELETE CASCADE,
  sender_profile_id uuid NOT NULL REFERENCES public.profiles(id),
  original_text text NOT NULL,
  original_language text NOT NULL DEFAULT 'en',
  translations jsonb NOT NULL DEFAULT '{}'::jsonb,  -- {"fa": "ترجمه", "es": "traducción"}
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.team_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for team_channels
CREATE POLICY "Users can view channels they belong to"
  ON public.team_channels FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.team_channel_members tcm
      JOIN public.profiles p ON p.id = tcm.profile_id
      WHERE tcm.channel_id = team_channels.id AND p.user_id = auth.uid()
    )
    OR
    public.has_any_role(auth.uid(), ARRAY['admin'::app_role])
  );

CREATE POLICY "Admin can create channels"
  ON public.team_channels FOR INSERT
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'workshop'::app_role]));

CREATE POLICY "Admin can update channels"
  ON public.team_channels FOR UPDATE
  USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role]));

-- RLS Policies for team_channel_members
CREATE POLICY "Users can view members of their channels"
  ON public.team_channel_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.team_channel_members tcm2
      JOIN public.profiles p ON p.id = tcm2.profile_id
      WHERE tcm2.channel_id = team_channel_members.channel_id AND p.user_id = auth.uid()
    )
    OR
    public.has_any_role(auth.uid(), ARRAY['admin'::app_role])
  );

CREATE POLICY "Admin can manage members"
  ON public.team_channel_members FOR INSERT
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'workshop'::app_role]));

CREATE POLICY "Admin can remove members"
  ON public.team_channel_members FOR DELETE
  USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role]));

-- RLS Policies for team_messages
CREATE POLICY "Users can view messages in their channels"
  ON public.team_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.team_channel_members tcm
      JOIN public.profiles p ON p.id = tcm.profile_id
      WHERE tcm.channel_id = team_messages.channel_id AND p.user_id = auth.uid()
    )
    OR
    public.has_any_role(auth.uid(), ARRAY['admin'::app_role])
  );

CREATE POLICY "Members can send messages in their channels"
  ON public.team_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team_channel_members tcm
      JOIN public.profiles p ON p.id = tcm.profile_id
      WHERE tcm.channel_id = team_messages.channel_id AND p.user_id = auth.uid()
      AND p.id = team_messages.sender_profile_id
    )
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_channel_members;

-- Indexes
CREATE INDEX idx_team_messages_channel ON public.team_messages(channel_id, created_at DESC);
CREATE INDEX idx_team_channel_members_profile ON public.team_channel_members(profile_id);
CREATE INDEX idx_team_channel_members_channel ON public.team_channel_members(channel_id);

-- Seed a default "General" channel
INSERT INTO public.team_channels (name, description, channel_type)
VALUES ('General', 'Company-wide announcements and chat', 'group');
