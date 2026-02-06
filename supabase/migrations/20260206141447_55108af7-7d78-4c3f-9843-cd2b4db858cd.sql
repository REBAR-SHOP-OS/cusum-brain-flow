-- Update communications RLS: all authenticated users can see all communications (shared company inbox)
DROP POLICY IF EXISTS "Users can read own communications" ON public.communications;
CREATE POLICY "Authenticated users can read all communications"
  ON public.communications
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Also update insert/update to allow any authenticated user
DROP POLICY IF EXISTS "Users can insert own communications" ON public.communications;
CREATE POLICY "Authenticated users can insert communications"
  ON public.communications
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update own communications" ON public.communications;
CREATE POLICY "Authenticated users can update communications"
  ON public.communications
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can delete own communications" ON public.communications;
CREATE POLICY "Authenticated users can delete communications"
  ON public.communications
  FOR DELETE
  USING (auth.uid() IS NOT NULL);