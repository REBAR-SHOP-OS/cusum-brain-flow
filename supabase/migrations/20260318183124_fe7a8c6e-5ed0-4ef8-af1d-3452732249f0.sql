CREATE POLICY "pcl_delete"
  ON public.purchasing_confirmed_lists
  FOR DELETE
  TO authenticated
  USING (
    company_id::text IN (
      SELECT p.company_id::text FROM public.profiles p WHERE p.user_id = auth.uid()
    )
  );