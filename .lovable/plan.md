

## Fix DM Creation for All Users

### Root Cause

The `INSERT` policy on `team_channel_members` has a critical bug in its "empty channel" fallback condition:

```sql
-- BROKEN: compares column to itself, always true
NOT (EXISTS (SELECT 1 FROM team_channel_members tcm WHERE tcm.channel_id = tcm.channel_id))
```

This means the `NOT EXISTS` is always `false`, so only admins or existing channel members can add members. When any user creates a new channel (group or DM), they can't add the initial members because nobody is a member yet.

### Fix

Replace the INSERT policy on `team_channel_members` with one that checks:
1. User is already a member of the channel, OR
2. User is an admin, OR
3. User is the **creator** of the channel (via `team_channels.created_by`)

This properly allows the channel creator to populate initial membership.

### Technical Steps

1. **Database migration** -- Drop the broken INSERT policy and create a corrected one:

```sql
DROP POLICY IF EXISTS "Users can add members to accessible channels"
  ON public.team_channel_members;

CREATE POLICY "Users can add members to accessible channels"
  ON public.team_channel_members
  FOR INSERT TO authenticated
  WITH CHECK (
    is_channel_member(auth.uid(), channel_id)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.team_channels tc
      WHERE tc.id = channel_id
        AND tc.created_by = auth.uid()
    )
  );
```

2. **No code changes needed** -- The existing `useChannelManagement.ts` logic is correct; only the RLS policy was blocking it.

