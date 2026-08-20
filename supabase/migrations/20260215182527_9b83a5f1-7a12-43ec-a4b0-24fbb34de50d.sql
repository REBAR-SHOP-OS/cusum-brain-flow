
DROP POLICY IF EXISTS "Users can add members to accessible channels"
  ON public.team_channel_members;

CREATE POLICY "Users can add members to accessible channels"
  ON public.team_channel_members
  FOR INSERT TO authenticated
  WITH CHECK (
    is_channel_member(auth.uid(), channel_id)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.team_channels tc
      WHERE tc.id = channel_id
        AND tc.created_by = auth.uid()
    )
  );
