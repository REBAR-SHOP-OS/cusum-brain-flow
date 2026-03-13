

# Fix DM Notification — Remove Duplicate Push & Clean Up Title

## Investigation Results
- DM channels correctly have only 2 members in `team_channel_members`
- `handleTeamMessage` correctly queries only channel members minus sender
- All 20 recent DM notifications verified: every recipient IS a member of the DM channel
- **BUG FOUND**: Each team message sends **2 push notifications** per recipient:
  1. Direct `send-push` call in `notify-on-message` (lines 107-119)
  2. `push_on_notification_insert` DB trigger → `push-on-notify` → `send-push` (fires when notification row is inserted)

## Changes

### 1. `supabase/functions/notify-on-message/index.ts` — Remove duplicate push
Remove the direct `send-push` calls in both `handleTeamMessage` and `handleSupportMessage`. The `push-on-notify` trigger already handles push delivery when a notification row is inserted — the direct calls are redundant and cause double notifications.

- **handleTeamMessage**: Remove lines 107-119 (pushPromises) and line 130 (Promise.allSettled)
- **handleSupportMessage**: Remove lines 194-206 (pushPromises) and line 217 (Promise.allSettled)
- Keep only the notification row inserts — push will fire automatically via trigger

### 2. Cleaner DM notification title
For DM channels, change title from `"Sender in #Sender & Recipient"` to just `"Sender"` — the channel name is redundant and cluttered for DMs.
- Fetch `channel_type` alongside `name` from `team_channels`
- If `channel_type === 'dm'`, use title: `senderName` instead of `"${senderName} in #${channelName}"`

### Files
- `supabase/functions/notify-on-message/index.ts`

