

# Make Team Members Visible in Chat Launcher

## Problem

The Chat popover already has a "Team Members" section with all active users, but it's hidden below the Channels and Direct Messages lists. Users have to scroll past all existing conversations to find it, making it practically invisible.

## Solution

Reorganize the Chat launcher popover in `DockChatBar.tsx` to put **Team Members** at the top, above Channels and DMs. This makes it immediately visible when the popover opens. Users can click any team member to instantly start a DM.

## Single File Change

### `src/components/chat/DockChatBar.tsx`

- Move the "Team Members" block (lines 146-165) to appear **first** inside the ScrollArea, before Channels and DMs
- Add a "Start a Chat" label instead of "Team Members" to make intent clearer
- Add a thin separator between sections for visual clarity

No new files, no new dependencies, no database changes. The `useOpenDM` hook and `handleOpenDM` handler already handle DM creation with deduplication (reuses existing DM if one exists).

