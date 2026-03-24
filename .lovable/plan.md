

## Transform "My Notes" into a Shared Team Chat

### Problem
"My Notes" currently works as a personal notes system. The user wants it to be a shared chat space where all `@rebar.shop` users can post messages that persist — essentially another group channel.

### Approach
Instead of building a custom chat from scratch, create a dedicated database channel called "My Notes" (type `group`) and reuse the existing `MessageThread` component. This gives full chat capabilities (messages, attachments, mentions, etc.) for free.

### Changes

**Database Migration** — Insert a "My Notes" channel:
```sql
INSERT INTO public.team_channels (name, channel_type, created_by)
VALUES ('My Notes', 'group', (SELECT user_id FROM public.profiles WHERE email = 'radin@rebar.shop' LIMIT 1))
ON CONFLICT DO NOTHING;
```

**File**: `src/components/teamhub/ChannelSidebar.tsx`
- Instead of firing `onSelect("__my_notes__")`, find the "My Notes" channel from the channels list and select its real channel ID
- Keep the `StickyNote` icon and position in the sidebar

**File**: `src/pages/TeamHub.tsx`
- Remove the `isNotesView` / `__my_notes__` special case
- "My Notes" channel will render via the normal `MessageThread` path since it's now a real channel
- All `@rebar.shop` users can read and write (same as Official Group behavior)

**File**: `src/components/teamhub/PersonalNotes.tsx`
- No longer needed — can be kept but won't be rendered

### Result
- "My Notes" becomes a shared chat visible to all `@rebar.shop` users
- Messages persist in the database like any other channel
- Full chat features: attachments, mentions, voice messages, forwarding, etc.

| File | Change |
|---|---|
| DB Migration | Create "My Notes" group channel |
| `src/components/teamhub/ChannelSidebar.tsx` | Select real channel ID instead of `__my_notes__` magic string |
| `src/pages/TeamHub.tsx` | Remove `isNotesView` special case |

