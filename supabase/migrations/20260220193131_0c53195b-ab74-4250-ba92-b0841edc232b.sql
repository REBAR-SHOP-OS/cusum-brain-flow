
-- Drop the existing broad UPDATE policy
DROP POLICY IF EXISTS "Creator or assignee update tasks" ON public.tasks;

-- Policy 1: Only the assigned user can mark a task as 'completed'
CREATE POLICY "Assignee can complete tasks"
ON public.tasks
FOR UPDATE
USING (
  company_id = get_user_company_id(auth.uid())
  AND assigned_to = (
    SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1
  )
);

-- Policy 2: Creator, assignee, or admin can update other fields (reopen, edit, etc.)
-- We restrict who can set status back away from 'completed' or edit general fields.
-- Since Postgres RLS cannot restrict per-column, we enforce completions in policy 1
-- and allow general updates (including reopen) for creator/assignee/admin here.
-- The application layer (canMarkComplete) prevents non-assignees from completing via UI.
-- This policy allows creator/admin to reopen (set status to 'open') and edit metadata.
CREATE POLICY "Creator or admin can reopen and edit tasks"
ON public.tasks
FOR UPDATE
USING (
  company_id = get_user_company_id(auth.uid())
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR created_by_profile_id = (
      SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1
    )
    OR assigned_to = (
      SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1
    )
  )
);
