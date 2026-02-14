

# Browser Push Notifications for All Users

## What This Does

When any real-time notification arrives (attendance alerts, agent messages, etc.), the browser will show a native OS-level push notification popup (like the screenshot you shared) even if the tab is in the background. The Mockingjay whistle plays alongside it.

## Implementation

### 1. New file: `src/lib/browserNotification.ts`

A small utility with two functions:

- **`requestNotificationPermission()`** -- calls `Notification.requestPermission()` once on app load
- **`showBrowserNotification(title, body, linkTo?)`** -- creates a native `new Notification(...)` with:
  - App icon (`/lovable-uploads/...` or favicon)
  - Click handler that focuses the tab and navigates to `linkTo` (e.g., `/timeclock`)

### 2. Modified file: `src/hooks/useNotifications.ts`

- On mount (`useEffect`), call `requestNotificationPermission()` so the browser prompts the user to allow notifications
- In the realtime `INSERT` handler (where `playMockingjayWhistle()` already fires), also call `showBrowserNotification(payload.new.title, payload.new.description, payload.new.link_to)`

### Technical Details

| Item | Detail |
|------|--------|
| New file | `src/lib/browserNotification.ts` |
| Modified file | `src/hooks/useNotifications.ts` |
| API used | Native Web Notification API (no dependencies) |
| Permission | Requested once on mount; browser remembers the choice |
| Click behavior | Focuses app tab, navigates to notification's `link_to` path |
| Fallback | If permission denied or API unavailable, silently skips |

