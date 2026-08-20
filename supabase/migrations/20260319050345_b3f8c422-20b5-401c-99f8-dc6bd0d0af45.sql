-- Drop incorrect policy and recreate with proper logic
DROP POLICY IF EXISTS "Admins can read company vizzy_memory" ON public.vizzy_memory;

CREATE POLICY "Admins can read company vizzy_memory"
ON public.vizzy_memory
FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON ur.user_id = p.id
    WHERE p.user_id = auth.uid() AND ur.role = 'admin'
  )
);