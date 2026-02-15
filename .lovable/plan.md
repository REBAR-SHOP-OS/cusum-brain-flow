

## Audit and Fix: Message Notifications and Push Alerts

### Current State (Bugs Found)

**Bug 1: Team Chat messages create ZERO notifications**
When a user sends a message in a team channel (group or DM), the other channel members receive nothing -- no notification centre entry, no push notification, no sound on their device. The only way they see the message is if they happen to have the Team Hub open with that channel selected (realtime subscription picks it up). If the app tab is closed, the message is completely invisible.

**Bug 2: Support Chat visitor messages only notify the current viewer**
When a visitor sends a support message, only the agent who currently has that conversation open hears the Mockingjay whistle (browser-side realtime listener in `SupportChatView.tsx`). Other agents get nothing -- no notification centre entry, no push notification on their device.

**Bug 3: Service Worker doesn't play a notification sound**
The `sw-push.js` file shows a basic push notification with `vibrate` but does not include a sound file for the notification ringtone. Mobile devices and desktops that receive push notifications will only vibrate/show silently without the custom notification sound.

---

### Plan

#### 1. Create a new edge function: `notify-on-message`

This function will be called via a database webhook (pg_net HTTP trigger) whenever a new row is inserted into `team_messages` or `support_messages`. It will:

- **For team messages**: Look up all members of the channel via `team_channel_members`, exclude the sender, and for each member:
  - Insert a row into the `notifications` table (type: "notification", title: "New message in #channel-name", description: message preview, link_to: "/team-hub")
  - Call the existing `send-push` function internally to deliver a web push notification to each member's subscribed devices

- **For support messages** (visitor-sent only): Look up all agents with 'admin' or 'office' roles, and for each:
  - Insert a notification row (title: "New support message from Visitor Name", link_to: "/support-inbox")
  - Trigger push notification via `send-push`

#### 2. Create database trigger to call the edge function

Add a database webhook trigger (using `pg_net`) on `team_messages` and `support_messages` tables that fires on INSERT and calls the `notify-on-message` edge function with the new row data.

Alternatively, use a simpler approach: a PL/pgSQL trigger that inserts directly into the `notifications` table and uses `pg_net` to call `send-push` for each recipient. This avoids an extra edge function hop.

**Chosen approach**: A single edge function `notify-on-message` invoked by a database webhook trigger. This keeps the logic centralized and testable.

#### 3. Update `sw-push.js` to play notification sound

Add the `silent: false` option and reference the existing `/mockingjay.mp3` sound file so push notifications on other devices play an audible alert. Note: not all browsers support custom sounds in push notifications, but we set it where supported.

#### 4. Prevent duplicate local notifications

In `SupportChatView.tsx`, the realtime listener already plays a sound and shows a browser notification for visitor messages. Since the new system will handle this via push, we should check whether the user is currently viewing that conversation to avoid double-alerting. The notification centre entry will still be created regardless.

---

### Technical Details

**Edge Function: `supabase/functions/notify-on-message/index.ts`**

```text
POST body (from database webhook):
{
  "type": "INSERT",
  "table": "team_messages" | "support_messages",
  "record": { ... row data ... }
}

Logic:
1. Parse table name and record
2. If team_messages:
   a. Query channel name from team_channels
   b. Query all members from team_channel_members (exclude sender)
   c. Map profile_id -> user_id via profiles table
   d. For each recipient user_id:
      - INSERT into notifications
      - Call send-push internally (HTTP fetch to self)
3. If support_messages (sender_type = 'visitor'):
   a. Query conversation details (visitor_name)
   b. Query all users with admin/office role
   c. For each:
      - INSERT into notifications
      - Call send-push
```

**Database Migration:**

```text
- Enable pg_net extension (if not already)
- Create a trigger function that uses pg_net to POST to the edge function
- Attach trigger to team_messages (AFTER INSERT)
- Attach trigger to support_messages (AFTER INSERT, when sender_type = 'visitor')
```

**sw-push.js update:**
- Add notification sound path for browsers that support it

**Files Changed:**
1. NEW: `supabase/functions/notify-on-message/index.ts`
2. EDIT: `public/sw-push.js` -- add sound option
3. DB MIGRATION: Create webhook triggers on team_messages and support_messages
4. EDIT: `src/components/support/SupportChatView.tsx` -- guard against double-notification when push is already handling it (optional refinement)
