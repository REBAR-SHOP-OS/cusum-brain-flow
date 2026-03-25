

## Fix: Allow Zahra to Complete Feedback Tasks (RLS Policy)

### Root Cause
The `tasks` table has two UPDATE RLS policies:
1. **"Assignee can complete tasks"** — requires `assigned_to = current_profile_id`
2. **"Creator or admin can reopen and edit tasks"** — requires admin, creator, or assignee

Zahra's mirrored feedback tasks are assigned to Radin, not Zahra. She is neither the assignee, creator, nor admin — so the database silently rejects her updates.

### Solution
Add a new RLS UPDATE policy that allows delegate users to update feedback tasks assigned to their delegated profiles.

### Database Migration

```sql
-- Allow Zahra (delegate) to update feedback tasks assigned to Radin
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
```

This policy grants Zahra (profile `3a59...`) UPDATE access on feedback tasks (`source = screenshot_feedback` or `feedback_verification`) that are assigned to Radin (profile `5d94...`).

### Changes Summary

| Change | Detail |
|---|---|
| Migration | Add one new RLS UPDATE policy on `tasks` table for delegate feedback access |

No frontend code changes needed — the `canMarkComplete` / `isFeedbackTask` logic already permits Zahra on the client side. Only the server-side RLS was blocking.

