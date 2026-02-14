
# Notification Center -- Audit, Fixes, and Improvements

## Current Issues Found

### Accessibility
- **No focus trap**: Panel opens as a slide-over but does not trap keyboard focus, allowing Tab to reach elements behind the backdrop
- **Dismiss button hidden until hover**: The X dismiss button uses `opacity-0 group-hover:opacity-100`, making it invisible to keyboard users and screen readers
- **No ARIA landmark/role**: The panel lacks `role="dialog"` and `aria-modal="true"`
- **Tab buttons lack ARIA**: Tabs should use `role="tablist"` / `role="tab"` / `aria-selected` pattern
- **Checkmark button has no aria-label**: The todo checkmark only has a `title` attribute
- **No focus-visible ring**: Interactive elements inside the panel lack visible focus indicators

### UX / Usability
- **No "Mark all read" / "Dismiss all" for To-do and Ideas tabs**: These actions only appear in the Notifications tab, but users need them in all tabs
- **Truncated text**: Notification titles are cut off (`truncate` on 280px panel) with no way to see full text without expanding
- **No priority icon on items**: High-priority items only get a subtle left border -- easy to miss in dark theme
- **Empty state is too minimal**: Just an icon and text with no call-to-action
- **No unread dot indicator**: Individual items lack a visual unread dot -- relies only on background shade which is subtle
- **Panel header lacks unread count**: The "Inbox" title does not show how many unread items exist
- **Badge counts show total, not unread**: Tab badges show total count (13, 36, 1) rather than unread count, which is more actionable

### Performance / Technical
- **Stale closure in `dismissAll`**: Uses `notifications` from closure -- if state changes between render and click, wrong items could be dismissed
- **No error handling UI**: Database operations (`markRead`, `dismiss`, etc.) silently fail with no toast/feedback
- **No optimistic rollback**: Optimistic UI updates don't roll back on database errors
- **Realtime channel not filtered by user**: Subscribes to ALL notification changes on the table, not just for the current user (relies on RLS for data, but still receives empty payloads for other users' rows)

---

## Implementation Plan

### 1. Accessibility Fixes (InboxPanel.tsx)
- Add `role="dialog"`, `aria-modal="true"`, `aria-label="Inbox"` to the panel wrapper
- Implement focus trap: auto-focus the close button on open, trap Tab within the panel
- Add `role="tablist"` to tab container, `role="tab"` + `aria-selected` to each tab button, `role="tabpanel"` to content area
- Make dismiss button always visible to assistive tech (`sr-only` fallback or `aria-label` with permanent visibility for keyboard)
- Add `aria-label="Mark as done"` to checkmark buttons
- Add `focus-visible:ring-2` styles to all interactive elements

### 2. UX Improvements (InboxPanel.tsx)
- Change tab badges to show **unread count** instead of total count (show total only if all read)
- Add a small unread dot indicator next to notification titles for unread items
- Add a priority indicator icon (AlertTriangle for high, minus for low) next to the agent avatar
- Show "Mark all read" action in **all tabs** (not just Notifications)
- Add "Dismiss all" action for To-do and Ideas tabs
- Show unread count in the panel header: "Inbox (4 unread)"
- Improve empty state with a subtle illustration-style message

### 3. Error Handling (useNotifications.ts)
- Add toast notifications for failed database operations using `sonner`
- Implement optimistic rollback: if `supabase.update()` returns an error, revert state
- Add error boundary around notification actions

### 4. Performance (useNotifications.ts)
- Filter realtime channel subscription by `user_id` using the `filter` parameter to reduce noise
- Wrap `dismissAll` and `markAllRead` with fresh state references to avoid stale closures

---

## Technical Details

### File: `src/components/panels/InboxPanel.tsx`
- Add `role="dialog"` and `aria-modal="true"` to the `motion.div` panel element
- Add `useRef` + `useEffect` to auto-focus close button and trap focus within panel
- Refactor tab bar to use proper ARIA tab pattern (`role="tablist"`, `role="tab"`, `role="tabpanel"`)
- Add `aria-label` to dismiss and checkmark buttons
- Add `focus-visible:ring-2 focus-visible:ring-primary` to all buttons
- Change badge logic: `counts[tab.key]` becomes `unreadCounts[tab.key]` computed from `.filter(n => n.status === "unread").length`
- Add unread dot: small `w-2 h-2 rounded-full bg-primary` next to title when `status === "unread"`
- Add priority icon: render `AlertTriangle` (lucide) for `priority === "high"` items
- Move "Mark all read" / "Dismiss all" actions to render for all tabs
- Update header: `Inbox` becomes `Inbox {unreadCount > 0 && `(${unreadCount} unread)`}`

### File: `src/hooks/useNotifications.ts`
- Import `toast` from `sonner`
- Wrap each `supabase.update()` call with error check; on error, revert optimistic state and show toast
- Add `filter` to realtime channel: `filter: "user_id=eq." + userId` (requires fetching current user id)
- Fix stale closure: use functional state updater in `dismissAll` and `markAllRead` instead of reading from `notifications` directly

### Files Unchanged
- `src/lib/notificationSound.ts` -- no changes needed
- `src/lib/browserNotification.ts` -- no changes needed
- `src/components/layout/TopBar.tsx` -- already has aria-label (from Sprint 1)
