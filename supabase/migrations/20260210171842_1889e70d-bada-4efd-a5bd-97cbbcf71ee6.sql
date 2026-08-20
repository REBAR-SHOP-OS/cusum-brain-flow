
-- Tighten INSERT policies to require the user has a profile in the system
DROP POLICY "Authenticated users can insert transcript entries" ON public.meeting_transcript_entries;
CREATE POLICY "Users with profiles can insert transcript entries"
  ON public.meeting_transcript_entries FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid())
  );

DROP POLICY "Authenticated users can insert action items" ON public.meeting_action_items;
CREATE POLICY "Users with profiles can insert action items"
  ON public.meeting_action_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid())
  );

DROP POLICY "Authenticated users can update action items" ON public.meeting_action_items;
CREATE POLICY "Users with profiles can update action items"
  ON public.meeting_action_items FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid())
  );
