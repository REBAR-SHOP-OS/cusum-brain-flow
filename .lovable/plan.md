

# Enable Push Notifications via Service Worker

## Current Behavior
Browser notifications only work when the app tab is actively open. The realtime subscription catches new DB inserts and fires `new Notification(...)`. If the tab is closed or the browser is not open, no notification appears.

## What Needs to Change
Add Web Push notifications using a Service Worker so users receive alerts even when the app is not open.

## Implementation Steps

### 1. Create a Service Worker for push notifications
- **New file**: `public/sw-push.js`
- Listens for `push` events and shows native notifications
- Handles notification click to open/focus the app

### 2. Register the Service Worker on app load
- **Modify**: `src/lib/browserNotification.ts`
- Add a `registerPushSubscription()` function that:
  - Registers the service worker
  - Subscribes to push via `pushManager.subscribe()` using VAPID keys
  - Sends the subscription endpoint to the database for later use

### 3. Store push subscriptions in the database
- **New table**: `push_subscriptions` with columns: `id`, `user_id`, `endpoint`, `p256dh`, `auth`, `created_at`
- RLS: users can only manage their own subscriptions

### 4. Create an edge function to send push notifications
- **New file**: `supabase/functions/send-push/index.ts`
- Called by the existing `comms-alerts` function (or a DB trigger) when a notification is inserted
- Reads subscriptions for the target user and sends web-push messages

### 5. Generate VAPID keys
- A pair of VAPID keys (public + private) will be stored as secrets
- The public key is used client-side for subscription
- The private key is used server-side for sending pushes

### 6. Wire into existing notification flow
- **Modify**: The `comms-alerts` edge function (or add a DB trigger on `notifications` INSERT) to call `send-push` for each new notification

## Technical Details

| Item | Detail |
|------|--------|
| New files | `public/sw-push.js`, `supabase/functions/send-push/index.ts` |
| Modified files | `src/lib/browserNotification.ts`, `src/hooks/useNotifications.ts` |
| New DB table | `push_subscriptions` |
| New secrets | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` |
| Dependencies | `web-push` library (in edge function via npm specifier) |

## How It Will Work

1. User opens the app -- service worker registers and subscribes to push
2. Subscription is saved to `push_subscriptions` table
3. When a new notification is inserted into the `notifications` table, the edge function sends a web-push message to all of that user's subscriptions
4. The service worker receives the push event and shows a native OS notification, even if the tab is closed

