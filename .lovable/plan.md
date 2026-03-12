

# Real-Time Social Media Sync for 4 Users

## Problems Found

1. **`sattar@rebar.shop` is missing** from `is_social_team()` — currently only includes radin, zahra, neel. Sattar cannot see or edit any social posts.
2. **`social_approvals` RLS is per-user** — team members cannot see each other's approvals (policies check `auth.uid() = approver_id`).
3. **Neither `social_posts` nor `social_approvals` are in the realtime publication** — changes by one user do not push to others instantly.
4. **`useSocialApprovals` has no realtime subscription** — approval status changes are invisible until manual page refresh.

## Changes

### 1. Database Migration

```sql
-- Fix: Add sattar to social team
CREATE OR REPLACE FUNCTION public.is_social_team()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
      AND email IN (
        'radin@rebar.shop',
        'zahra@rebar.shop',
        'neel@rebar.shop',
        'sattar@rebar.shop'
      )
  )
$$;

-- Fix: Team-wide approval visibility
DROP POLICY IF EXISTS "Approvers can view their approvals" ON social_approvals;
DROP POLICY IF EXISTS "Post owners can view approvals" ON social_approvals;
DROP POLICY IF EXISTS "Approvers can update their approvals" ON social_approvals;

CREATE POLICY "Social team can view all approvals"
  ON social_approvals FOR SELECT TO authenticated
  USING (public.is_social_team());

CREATE POLICY "Social team can update approvals"
  ON social_approvals FOR UPDATE TO authenticated
  USING (public.is_social_team());

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.social_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.social_approvals;
```

### 2. `src/hooks/useSocialApprovals.ts`
- Add realtime subscription (same pattern as `useSocialPosts`) with debounced invalidation on `social_approvals` changes.

### 3. `src/hooks/useSocialPosts.ts`
- Already has realtime — no changes needed (channel name is static but acceptable since social team is identity-gated, not company-scoped).

