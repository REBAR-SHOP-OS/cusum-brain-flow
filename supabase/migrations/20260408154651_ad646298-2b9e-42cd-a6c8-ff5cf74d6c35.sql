
-- 1. team_messages SELECT: drop old, create new
DROP POLICY IF EXISTS "Members and admins can view messages" ON public.team_messages;
CREATE POLICY "Members can view messages, admins only for non-DM"
  ON public.team_messages
  FOR SELECT
  TO authenticated
  USING (
    is_channel_member(auth.uid(), channel_id)
    OR (
      has_any_role(auth.uid(), ARRAY['admin'::app_role])
      AND EXISTS (
        SELECT 1 FROM public.team_channels tc
        WHERE tc.id = team_messages.channel_id
          AND tc.channel_type != 'dm'
      )
    )
  );

-- 2. team_channels SELECT: drop old, create new
DROP POLICY IF EXISTS "Members and admins can view channels" ON public.team_channels;
CREATE POLICY "Members can view channels, admins only for non-DM"
  ON public.team_channels
  FOR SELECT
  TO authenticated
  USING (
    is_channel_member(auth.uid(), id)
    OR created_by = auth.uid()
    OR (
      has_any_role(auth.uid(), ARRAY['admin'::app_role])
      AND channel_type != 'dm'
    )
  );

-- 3. team_channel_members SELECT: drop old, create new
DROP POLICY IF EXISTS "Members and admins can view channel members" ON public.team_channel_members;
CREATE POLICY "Members can view channel members, admins only for non-DM"
  ON public.team_channel_members
  FOR SELECT
  TO authenticated
  USING (
    is_channel_member(auth.uid(), channel_id)
    OR (
      has_any_role(auth.uid(), ARRAY['admin'::app_role])
      AND EXISTS (
        SELECT 1 FROM public.team_channels tc
        WHERE tc.id = team_channel_members.channel_id
          AND tc.channel_type != 'dm'
      )
    )
  );

-- 4. team_messages DELETE: drop old, create new
DROP POLICY IF EXISTS "Sender or admin can delete messages" ON public.team_messages;
CREATE POLICY "Sender can delete own messages, admins only in non-DM"
  ON public.team_messages
  FOR DELETE
  TO authenticated
  USING (
    sender_profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    OR (
      has_any_role(auth.uid(), ARRAY['admin'::app_role])
      AND EXISTS (
        SELECT 1 FROM public.team_channels tc
        WHERE tc.id = team_messages.channel_id
          AND tc.channel_type != 'dm'
      )
    )
  );
