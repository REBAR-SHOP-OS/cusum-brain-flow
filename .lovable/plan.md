

# Enforce Strict Message Privacy — No Cross-User Message Visibility

## Problem
The current RLS policy on `team_messages` includes an **admin bypass**:
```sql
-- Current SELECT policy:
is_channel_member(auth.uid(), channel_id) OR has_any_role(auth.uid(), ARRAY['admin'::app_role])
```
This allows any user with the `admin` role to read **ALL messages** in **ALL channels**, including private DMs between other users. This violates the mandatory privacy rule.

Similarly, `team_channels` and `team_channel_members` have admin bypasses allowing admins to see all channels and memberships.

## Solution
Remove the admin bypass from SELECT policies on DM channels. Admins should only bypass for **group** channels, not **DM** channels.

### 1. Database Migration — Tighten RLS Policies

**`team_messages` SELECT policy** — Replace:
```sql
-- OLD: admins see everything
is_channel_member(auth.uid(), channel_id) 
  OR has_any_role(auth.uid(), ARRAY['admin'::app_role])

-- NEW: members-only for DMs, admin bypass only for group channels
is_channel_member(auth.uid(), channel_id) 
  OR (
    has_any_role(auth.uid(), ARRAY['admin'::app_role]) 
    AND EXISTS (
      SELECT 1 FROM team_channels tc 
      WHERE tc.id = channel_id 
      AND tc.channel_type != 'dm'
    )
  )
```

**`team_channels` SELECT policy** — Replace:
```sql
-- OLD
is_channel_member(auth.uid(), id) OR created_by = auth.uid() 
  OR has_any_role(auth.uid(), ARRAY['admin'::app_role])

-- NEW: admin bypass only for non-DM channels
is_channel_member(auth.uid(), id) OR created_by = auth.uid()
  OR (has_any_role(auth.uid(), ARRAY['admin'::app_role]) AND channel_type != 'dm')
```

**`team_channel_members` SELECT policy** — Replace:
```sql
-- OLD
is_channel_member(auth.uid(), channel_id) 
  OR has_any_role(auth.uid(), ARRAY['admin'::app_role])

-- NEW: admin bypass only for non-DM channels  
is_channel_member(auth.uid(), channel_id)
  OR (
    has_any_role(auth.uid(), ARRAY['admin'::app_role])
    AND EXISTS (
      SELECT 1 FROM team_channels tc 
      WHERE tc.id = channel_id 
      AND tc.channel_type != 'dm'
    )
  )
```

**`team_messages` DELETE policy** — Also restrict admin delete to non-DM:
```sql
-- NEW: admins can delete in group channels, or own messages in DMs
(sender_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1))
OR (
  has_any_role(auth.uid(), ARRAY['admin'::app_role])
  AND EXISTS (
    SELECT 1 FROM team_channels tc 
    WHERE tc.id = channel_id 
    AND tc.channel_type != 'dm'
  )
)
```

### 2. No Frontend Changes Needed
The frontend already filters by `channel_id` and only shows channels the user is a member of. The RLS changes ensure the database enforces privacy at the deepest level — even if someone bypasses the UI.

## Summary

| Layer | Change |
|-------|--------|
| `team_messages` SELECT RLS | Remove admin bypass for DM channels |
| `team_messages` DELETE RLS | Restrict admin delete to group channels only |
| `team_channels` SELECT RLS | Remove admin bypass for DM channels |
| `team_channel_members` SELECT RLS | Remove admin bypass for DM channels |
| Frontend | No changes needed |

This ensures **no user, regardless of role**, can see DM messages they are not a participant of. Group channels retain admin oversight as expected.

