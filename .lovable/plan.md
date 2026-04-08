

# Mark Team Hub Messages as Read When Viewed

## Problem
The unread message count badges (teal circles with numbers) next to team members in Team Hub persist even after the user opens and views the conversation. They should be cleared when the user opens a DM with that person.

## Root Cause
When a user clicks a team member in the sidebar (`onClickMember`), the DM channel opens but the corresponding `notifications` records (with `status: "unread"` and `link_to: "/team-hub"`) are never updated to `"read"`. The `useUnreadSenders` hook queries these notifications and keeps showing the badge.

## Solution
Mark all unread notifications from a sender as read when the user opens that sender's DM conversation.

### File: `src/pages/TeamHub.tsx`

In the `onClickMember` handler (line 222-236), after successfully opening the DM channel, call a Supabase update to set `status = 'read'` on all notifications where:
- `user_id = current user`
- `link_to = '/team-hub'`
- `status = 'unread'`
- `metadata->sender_profile_id = clicked profileId`

This will trigger the realtime subscription in `useUnreadSenders` to refresh, clearing the badge automatically.

Also apply the same logic when selecting an existing DM channel from the sidebar (if channel maps to a profile).

### File: `src/components/teamhub/ChannelSidebar.tsx`

In the `handleClickMember` function (line 102-109), pass the `profileId` up so the parent can mark notifications as read.

### Implementation detail
```typescript
// In TeamHub.tsx onClickMember handler, after setting selectedChannelId:
const { data: { user } } = await supabase.auth.getUser();
if (user) {
  await supabase
    .from("notifications")
    .update({ status: "read" })
    .eq("user_id", user.id)
    .eq("link_to", "/team-hub")
    .eq("status", "unread")
    .filter("metadata->>sender_profile_id", "eq", profileId);
}
```

| File | Change |
|------|--------|
| `src/pages/TeamHub.tsx` | Mark notifications as read when opening a DM with a team member |

No database changes needed — uses existing `notifications` table and existing realtime subscription.

