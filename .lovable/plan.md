

## Fix: Notification Permission Errors Triggering False Vizzy Alerts

### Root Cause

The screenshot shows "Vizzy noticed an issue -- You may need updated permissions" which is a false alarm. Here's the chain:

1. `registerPushSubscription()` calls `pm.subscribe()` which throws `"The request is not allowed by the user agent"` when push permission is denied/unavailable (especially on iOS Safari)
2. This unhandled rejection is caught by `useGlobalErrorHandler`
3. After 3 occurrences, the global handler calls `reportToVizzy()` which inserts a row into `vizzy_fix_requests`
4. `useFixRequestMonitor` polls that table, sees the word "permission" in the description, and shows the misleading "contact your admin" toast

The open `vizzy_fix_requests` rows confirm this -- there are **3 entries** all with the same "permission denied" push notification error.

### Fixes

**1. Guard `registerPushSubscription()` properly** (`src/lib/browserNotification.ts`)

Before attempting `pm.subscribe()`, check that `Notification.permission === "granted"`. Wrap the entire push flow in a try/catch that does **not** re-throw, so no unhandled rejection escapes.

**2. Add "not allowed by the user agent" to ignored errors** (`src/hooks/useGlobalErrorHandler.ts`)

Add the pattern `"not allowed by the user agent"` to `isIgnoredError()` so push permission failures don't trigger error toasts or Vizzy reports.

**3. Clean up stale `vizzy_fix_requests`**

Mark the existing false-alarm rows as resolved so the toast stops appearing immediately.

### Technical Details

**File: `src/lib/browserNotification.ts`**
- In `registerPushSubscription()`, add an early return if `Notification.permission !== "granted"` before doing any service worker or PushManager work
- This prevents the unhandled rejection from ever occurring

**File: `src/hooks/useGlobalErrorHandler.ts`**
- Add `"not allowed by the user agent"` and `"denied permission"` to the `ignored` array in `isIgnoredError()`

**Database cleanup:**
- Update the 3 open `vizzy_fix_requests` rows with "permission" errors to `status = 'resolved'`

