

# Fix: Team Hub Not Loading

## Changes

### 1. `src/hooks/useUnreadSenders.ts`
- Change static channel name `"unread-senders"` to `\`unread-senders-${user.id}-${crypto.randomUUID()}\`` — prevents collision when multiple hook instances mount simultaneously (same pattern already applied to `useNotifications`).

### 2. `src/hooks/useGlobalErrorHandler.ts`
- Add `"NotSupportedError"` and `"no supported sources"` to the `isIgnoredError` list — prevents media element errors from triggering error toasts or crashing the component tree.

Two small, safe edits. No database or schema changes.

