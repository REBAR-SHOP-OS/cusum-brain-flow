CREATE POLICY "Delegate can update feedback tasks"
ON public.tasks
FOR UPDATE
TO authenticated
USING (
  company_id = get_user_company_id(auth.uid())
  AND source IN ('screenshot_feedback', 'feedback_verification')
  AND assigned_to IN (
    SELECT unnest(ARRAY['5d948a66-619b-4ee1-b5e3-063194db7171']::uuid[])
    FROM profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.id = '3a59f057-b232-4654-a2ea-d519fe22ccd5'
  )
);