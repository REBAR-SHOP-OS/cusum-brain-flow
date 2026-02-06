
-- Fix: calls should be private per user, emails stay shared
DROP POLICY IF EXISTS "Authenticated users can read all communications" ON public.communications;

CREATE POLICY "Users see own calls, shared emails"
  ON public.communications
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      source = 'gmail'                -- emails are shared across the company
      OR user_id = auth.uid()         -- calls/sms only visible to the user who synced them
    )
  );
