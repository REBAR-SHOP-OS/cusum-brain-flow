-- Tighten: Only allow creating channels in your own company
DROP POLICY IF EXISTS "Authenticated users can create channels" ON public.team_channels;
CREATE POLICY "Users can create channels in their company"
  ON public.team_channels FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.get_user_company_id(auth.uid())
    OR company_id IS NULL
  );

-- Tighten: Only allow adding members if you are a member of the channel or creating it
DROP POLICY IF EXISTS "Authenticated users can add channel members" ON public.team_channel_members;
CREATE POLICY "Users can add members to accessible channels"
  ON public.team_channel_members FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_channel_member(auth.uid(), channel_id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR NOT EXISTS (SELECT 1 FROM public.team_channel_members tcm WHERE tcm.channel_id = channel_id)
  );
