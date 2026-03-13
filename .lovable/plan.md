

# Add Unread Message Indicator to "Start a Chat" User List

## What
Show a green dot next to each user's name in the floating chat launcher ("Start a Chat" list) when there are unread messages from that user.

## How

### 1. Create a hook: `src/hooks/useUnreadSenders.ts`
- Query the `notifications` table for the current user where `status = 'unread'` and `link_to = '/team-hub'`
- Extract unique `sender_profile_id` values from `metadata` column
- Return a `Set<string>` of profile IDs that have unread messages
- Subscribe to realtime changes on `notifications` table to keep it live

### 2. Update `src/components/chat/DockChatBar.tsx`
- Import and use `useUnreadSenders()` hook
- In the `visibleProfiles.map(...)` block (line 156-170), add a green dot indicator next to users whose profile ID is in the unread set
- Green dot: small `w-2.5 h-2.5 rounded-full bg-emerald-500` positioned next to or after the user's name

### 3. Also update `src/components/teamhub/ChannelSidebar.tsx`
- Same unread indicator in the "Team Members" section (line 206-228)
- Show green dot next to member names when they have unread messages

## UI
- Small green circle badge next to the user name (right side), only visible when unread count > 0
- Disappears once user opens the DM (notifications get marked as read)

