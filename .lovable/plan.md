

# Enhanced Fix Request Queue with Auto-Refresh, User Notifications, and Bug Fixes

## Overview
Fix the active bugs causing errors on /home and /agent/social, then enhance the FixRequestQueue to auto-poll every 5 minutes and show actionable guidance when users need to take action.

## Changes

### 1. Fix: `src/pages/AgentWorkspace.tsx` -- `handleSend` temporal dead zone

The auto-briefing `useEffect` (line 75-93) calls `handleSend` which is defined later at line 269 via `useCallback`. Because `handleSendInternal` (its dependency) is also a `useCallback` defined at line 128, the reference works at runtime but can fail if the effect fires before the callbacks are fully initialized.

**Fix:** Move the auto-briefing logic to call `handleSendInternal` directly via a ref, or gate the effect on `handleSend` being stable by adding it to the dependency array properly. The safest fix is to use a ref for the send function:
- Create a `sendRef = useRef(handleSendInternal)` and keep it updated
- Auto-briefing effect uses `sendRef.current(...)` instead of `handleSend(...)`

This also fixes the `selectedDate` reference error since the effect closure will properly capture the initialized state.

### 2. Fix: Resolve all open fix requests for bugs we're fixing

After deploying, mark the existing `/home` and `/agent/social` fix requests as resolved since they'll be fixed by this change.

### 3. Enhance: `src/components/ceo/FixRequestQueue.tsx` -- Auto-refresh every 5 minutes

- Add a `setInterval` that calls `loadRequests()` every 5 minutes (300000ms)
- Show a "Last checked" timestamp at the bottom
- Add a manual refresh button
- Show a toast notification when new fix requests arrive (compare counts)
- Add severity classification based on error keywords:
  - "auto-recovery failed" = Critical (red badge)
  - "Repeated" = Warning (amber badge)  
  - Other = Info (blue badge)
- Add a user-action indicator: if the error description contains patterns like "auth", "login", "permission", show a note like "User may need to re-login"
- Add ability to auto-resolve duplicate entries (same description within 10 min window)

### 4. New: `src/hooks/useFixRequestMonitor.ts` -- Background monitor hook

A hook that runs in the app shell (not just CEO portal) to:
- Poll `vizzy_fix_requests` every 5 minutes for the current user's open requests
- If any are found that the user can act on (e.g., clear cache, re-login), show a subtle toast with guidance
- If the error is code-level (not user-actionable), it stays in the CEO queue only

### 5. Update: `src/App.tsx` or app shell -- Mount the monitor

Add `useFixRequestMonitor()` to the main app layout so it runs for all authenticated users.

## Technical Details

- Auto-refresh uses `setInterval` with cleanup in `useEffect`
- New requests detected by comparing current count vs previous count stored in `useRef`
- Severity classification is a simple keyword-match function
- User-actionable errors detected by patterns: "auth", "token", "permission", "session", "login", "storage"
- Non-actionable errors (ReferenceError, TypeError, etc.) stay as CEO-only visibility
- The monitor hook skips polling if user is not authenticated
- Deduplication: when loading requests, auto-resolve entries with matching `description` created within 10 minutes of each other (keep newest)

## Result
- The "helpers is not defined" and "handleSend/selectedDate" errors get fixed at the source
- The FixRequestQueue auto-refreshes every 5 minutes with visual feedback
- Users who can take action (re-login, clear cache) get notified automatically
- Code-level bugs stay visible to the CEO for escalation to Lovable
