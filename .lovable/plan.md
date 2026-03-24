

## Transform "My Notes" into a Private Self-Chat

### Problem
"My Notes" currently shows a personal notes editor. The user wants it to be a private chat — each `@rebar.shop` user gets their own "Saved Messages"-style channel where they can send messages (with full chat features: attachments, voice, etc.) that only they can see.

### Approach
When a user clicks "My Notes", create a self-DM channel using the existing `create_dm_channel` RPC (passing the user's own profile ID as both sender and target). Then render the normal `MessageThread` component for that channel. This gives full chat capabilities for free.

### Changes

**Database Migration** — Allow self-DM in the `create_dm_channel` function. Currently it likely blocks same-user DMs. Update the function to allow `_my_profile_id = _target_profile_id`, and mark such channels with a distinct name like `"__self_notes__"` so they can be identified.

```sql
-- Update create_dm_channel to allow self-DM
-- When both IDs match, create a channel named '__self_notes__' with type 'dm'
```

**File**: `src/pages/TeamHub.tsx`
1. When `selectedChannelId === "__my_notes__"`, instead of rendering `PersonalNotes`, auto-create/find the self-DM channel via `create_dm_channel(myProfile.id, myProfile.id)` and render `MessageThread` with that channel
2. Add a `useEffect` + state (`selfChannelId`) that resolves the self-DM channel ID when "My Notes" is selected
3. Remove the `PersonalNotes` import and rendering

**File**: `src/components/teamhub/ChannelSidebar.tsx`
- No changes needed — already emits `"__my_notes__"` on click

### Result
- Each user gets a private chat channel only they can access
- Full chat features: attachments, voice messages, mentions, forwarding
- Messages persist in the database with RLS ensuring privacy
- The `PersonalNotes` component becomes unused

| File | Change |
|---|---|
| DB Migration | Allow self-DM in `create_dm_channel` RPC |
| `src/pages/TeamHub.tsx` | Replace `PersonalNotes` with self-DM `MessageThread` |

