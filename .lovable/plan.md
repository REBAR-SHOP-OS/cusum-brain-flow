

## Add Task Comments, Attachments, and Refined RLS to Tasks

This plan implements the Architect agent's schema changes for the tasks system: a new comments table, multi-attachment support, and creator/assignee-aware RLS policies.

### Current State

- **tasks table**: Already has `attachment_url` (single text), `created_by_profile_id`, `assigned_to`, `company_id`
- **RLS**: Company-scoped (read/update for all users, insert for all users, delete for admins only)
- **task_comments table**: Does not exist

---

### Step 1: Add `attachment_urls` column to `tasks`

Add a `text[]` array column for multiple attachments (keep existing `attachment_url` for backward compatibility).

```sql
ALTER TABLE public.tasks ADD COLUMN attachment_urls text[] DEFAULT '{}';
```

### Step 2: Create `task_comments` table

```sql
CREATE TABLE public.task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id),
  content text NOT NULL,
  company_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
```

RLS policies for task_comments:
- **SELECT**: Users can read comments on tasks in their company
- **INSERT**: Users can add comments (must set their own profile_id)
- **DELETE**: Users can delete their own comments

### Step 3: Refine RLS on `tasks`

Replace the broad update/delete policies with creator/assignee-aware ones:

- **DROP** existing "Users update tasks in company" and "Admins delete tasks in company"
- **New UPDATE policy**: Creators can update all fields; assignees can update status only (handled at app level since Postgres RLS can't restrict columns -- policy allows update if creator OR assignee)
- **New DELETE policy**: Task creators and admins can delete

```sql
-- Drop old policies
DROP POLICY "Users update tasks in company" ON public.tasks;
DROP POLICY "Admins delete tasks in company" ON public.tasks;

-- Creator or assignee can update
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
```

### Step 4: Update frontend code

- Update `useHumanTasks.ts` or task-related components to use `attachment_urls` array
- Add a comments section UI to the task detail view (fetching from `task_comments`)

---

### Technical Summary

| Change | Target | Detail |
|--------|--------|--------|
| New column | `tasks.attachment_urls` | `text[]` for multiple file URLs |
| New table | `task_comments` | Comments with profile_id, task_id, company_id |
| RLS revision | `tasks` UPDATE | Creator, assignee, or admin |
| RLS revision | `tasks` DELETE | Creator or admin (was admin-only) |
| New RLS | `task_comments` | Company-scoped read, self-insert, self-delete |

