

# Fix: DM Messages Not Showing in Team Hub

## Root Cause

When clicking a team member in the Team Hub sidebar, `openDMMutation` creates/finds a DM channel and sets `selectedChannelId` to its ID. However, the rendering logic at line 313 of `TeamHub.tsx` checks:

```
activeChannel ? <MessageThread ... /> : <Welcome screen>
```

`activeChannel` is looked up via `channels.find(c => c.id === activeChannelId)`. DM channels created by the `create_dm_channel` RPC are either not returned by `useTeamChannels()` (filtered out due to `company_id` mismatch or channel type) or take time to appear after the `invalidateQueries` call. Since `activeChannel` is `undefined`, the code falls through to the "Welcome to Team Hub" empty state — skipping the `MessageThread` entirely.

The DockChatBox widget works because it passes `channelId` directly to `useTeamMessages()` and renders messages unconditionally.

## Fix

In `src/pages/TeamHub.tsx`, add a fallback rendering path: when `selectedChannelId` is set (not notes, not a known channel) but `activeChannel` is undefined, still render `MessageThread` using the DM target's profile name as the channel name. This mirrors how DockChatBox works.

### Changes to `src/pages/TeamHub.tsx`

1. **Track DM target info** — when `onClickMember` succeeds, store the target profile name alongside the channel ID in state (e.g., `dmTargetName`).

2. **Add DM rendering branch** — between the `activeChannel ?` check (line 313) and the `channelsLoading` fallback (line 332), add a condition: if `selectedChannelId` is set and not notes view, render `MessageThread` with:
   - `channelName` = the stored DM target name
   - `channelDescription` = "Direct message"
   - All other props same as the existing `activeChannel` branch

3. **Clear DM target** when switching to a known channel or notes.

### Rendering logic after fix:

```text
isNotesView && selfChannelId  →  MessageThread (My Notes)
isNotesView && !selfChannelId →  Loading spinner
activeChannel                 →  MessageThread (group/channel)
selectedChannelId (DM)        →  MessageThread (DM - NEW)
channelsLoading               →  Loading spinner
else                          →  Welcome screen
```

## Files Changed
| File | Change |
|------|--------|
| `src/pages/TeamHub.tsx` | Add `dmTargetName` state, populate on DM open, add DM rendering branch |

Single file, no backend changes.

