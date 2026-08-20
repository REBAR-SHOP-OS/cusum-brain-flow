
-- Add user_id column to communications table
ALTER TABLE public.communications ADD COLUMN user_id uuid REFERENCES auth.users(id);

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Authenticated users can read communications" ON public.communications;
DROP POLICY IF EXISTS "Authenticated users can insert communications" ON public.communications;
DROP POLICY IF EXISTS "Authenticated users can update communications" ON public.communications;
DROP POLICY IF EXISTS "Authenticated users can delete communications" ON public.communications;

-- Create new user-scoped RLS policies
CREATE POLICY "Users can read own communications"
ON public.communications
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own communications"
ON public.communications
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own communications"
ON public.communications
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own communications"
ON public.communications
FOR DELETE
USING (auth.uid() = user_id);

-- Service role bypass is built-in, so edge functions using service role can still insert for any user
