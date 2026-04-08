

# Show Unread Message Count per Team Member

## Problem
Currently, unread messages from a team member only show a small green dot. The user wants to see the **actual count** of unread messages as a number badge, and it should disappear once messages are read.

## Changes

### 1. `src/hooks/useUnreadSenders.ts`
- Change from `Set<string>` to `Map<string, number>` to track counts per sender
- Count occurrences of each `sender_profile_id` in unread notifications
- Return `unreadCounts` (Map) alongside `unreadSenderIds` (Set) for backward compatibility

### 2. `src/components/teamhub/ChannelSidebar.tsx`
- Import `unreadCounts` from the updated hook
- Replace the green dot (line 283-285) with a numbered badge:
  - Show count inside a small red/primary circle (e.g., `3`)
  - Only render when count > 0
  - Disappear when messages are read (count becomes 0)

### 3. `src/components/chat/DockChatBar.tsx`
- Same change: replace the green dot with a numbered badge using `unreadCounts`

| File | Change |
|------|--------|
| `useUnreadSenders.ts` | Track unread count per sender (Map instead of Set) |
| `ChannelSidebar.tsx` | Show numeric badge instead of green dot |
| `DockChatBar.tsx` | Show numeric badge instead of green dot |

