-- Add DELETE policy for team_messages (admin only)
CREATE POLICY "Admin can delete messages"
ON public.team_messages
FOR DELETE
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role]));

-- Add DELETE policy for team_channels (admin only) 
CREATE POLICY "Admin can delete channels"
ON public.team_channels
FOR DELETE
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role]));
