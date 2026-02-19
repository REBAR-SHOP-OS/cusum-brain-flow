
-- Step 1: Add attachment_urls array column to tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS attachment_urls text[] DEFAULT '{}';

-- Step 2: Create task_comments table
CREATE TABLE public.task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id),
  content text NOT NULL,
  company_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- task_comments RLS: company-scoped read
CREATE POLICY "Users read comments in company"
ON public.task_comments FOR SELECT TO authenticated
USING (company_id = get_user_company_id(auth.uid()));

-- task_comments RLS: self-insert
CREATE POLICY "Users insert own comments"
ON public.task_comments FOR INSERT TO authenticated
WITH CHECK (
  company_id = get_user_company_id(auth.uid())
  AND profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
);

-- task_comments RLS: self-delete
CREATE POLICY "Users delete own comments"
ON public.task_comments FOR DELETE TO authenticated
USING (
  profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
);

-- Step 3: Refine RLS on tasks
DROP POLICY IF EXISTS "Users update tasks in company" ON public.tasks;
DROP POLICY IF EXISTS "Admins delete tasks in company" ON public.tasks;

-- Creator, assignee, or admin can update
CREATE POLICY "Creator or assignee update tasks"
ON public.tasks FOR UPDATE TO authenticated
USING (
  company_id = get_user_company_id(auth.uid())
  AND (
    created_by_profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    OR assigned_to = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Creator or admin can delete
CREATE POLICY "Creator or admin delete tasks"
ON public.tasks FOR DELETE TO authenticated
USING (
  company_id = get_user_company_id(auth.uid())
  AND (
    created_by_profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);
