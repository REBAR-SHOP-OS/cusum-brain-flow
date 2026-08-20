-- Allow super admins (users with 'admin' role) to read all vizzy_memory records in their company
CREATE POLICY "Admins can read company vizzy_memory"
ON public.vizzy_memory
FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid()
  )
  AND public.has_role(
    (SELECT p2.id FROM public.profiles p2 WHERE p2.user_id = auth.uid() LIMIT 1),
    'admin'
  )
);