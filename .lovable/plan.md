

# Fix Chat Popover UI — Unread Badge Display

## Problem
In the "Start a Chat" popover (floating chat button), the unread message count badges next to team member names are either not appearing or visually broken. The `useUnreadSenders` hook fetches notification counts correctly, but the badge rendering in the popover needs UI fixes.

## Root Cause Analysis
The badge code at line 179-182 of `DockChatBar.tsx` looks correct logically, but two issues may cause display problems:
1. The badge uses `bg-primary text-primary-foreground` which may blend into the popover background depending on theme
2. Additionally, when `handleOpenDM` is called, notifications should also be marked as read (same fix applied in TeamHub.tsx but missing here)

## Changes

### File: `src/components/chat/DockChatBar.tsx`

1. **Sort members by unread count** — members with unread messages should appear at the top of the list, making badges immediately visible

2. **Improve badge styling** — make the unread count badge more prominent with a distinct color (e.g., `bg-destructive` or brighter `bg-primary`) and ensure proper sizing/positioning

3. **Mark notifications as read on DM open** — in `handleOpenDM` (line 107-118), after successfully opening the DM, mark the sender's notifications as read (same pattern already applied in `TeamHub.tsx`):
   ```typescript
   await supabase
     .from("notifications")
     .update({ status: "read" })
     .eq("user_id", user.id)
     .eq("link_to", "/team-hub")
     .eq("status", "unread")
     .filter("metadata->>sender_profile_id", "eq", profileId);
   ```

4. **Badge UI fix** — update the badge element to use more visible styling:
   - Use `bg-destructive text-white` for better contrast
   - Add `leading-none` for proper vertical centering
   - Ensure `min-w-[20px]` keeps the badge round for single digits

| File | Change |
|------|--------|
| `src/components/chat/DockChatBar.tsx` | Sort by unread count, improve badge styling, mark as read on open |

No database changes needed.

