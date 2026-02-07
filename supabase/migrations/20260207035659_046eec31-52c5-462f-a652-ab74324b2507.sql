
-- Fix the SELECT policy for communications so each user only sees their own emails
DROP POLICY IF EXISTS "Users see own calls, shared emails" ON public.communications;

CREATE POLICY "Users see own communications"
ON public.communications
FOR SELECT
USING (auth.uid() = user_id);
