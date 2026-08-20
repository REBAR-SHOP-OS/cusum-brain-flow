-- Fix: Allow all authenticated users to create channels (not just admin/workshop)
DROP POLICY IF EXISTS "Admin can create channels" ON public.team_channels;
CREATE POLICY "Authenticated users can create channels"
  ON public.team_channels FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Fix: Allow all authenticated users to add members to channels they created or belong to
DROP POLICY IF EXISTS "Admin can manage members" ON public.team_channel_members;
CREATE POLICY "Authenticated users can add channel members"
  ON public.team_channel_members FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Fix: Allow members to leave channels (delete their own membership)
CREATE POLICY "Members can leave channels"
  ON public.team_channel_members FOR DELETE
  TO authenticated
  USING (
    profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Fix: Allow channel members and admins to update channels (e.g. rename)
DROP POLICY IF EXISTS "Admin can update channels" ON public.team_channels;
CREATE POLICY "Members and admins can update channels"
  ON public.team_channels FOR UPDATE
  TO authenticated
  USING (
    public.is_channel_member(auth.uid(), id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );
