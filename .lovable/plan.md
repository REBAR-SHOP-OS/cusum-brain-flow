

# Fix: Notification 404s + Field Employee Count Shows 0

## Problem 1: Notification links go 404

When clicking a notification in the Inbox panel, it navigates to routes like `/bills`, `/invoicing`, `/invoicing/overdue`, `/accounting/bills/8702`, `/accounting/invoices/8703` -- none of which exist. The only accounting route is `/accounting`.

**Root cause**: The AI agent (edge function) generates free-form `link_to` values. The app has no route matching for these paths.

**Fix**: Add a route normalizer in `InboxPanel.tsx` that maps invalid notification routes to valid ones before navigating. This is surgical -- only touches the `handleToggle` function.

Route mapping:
- `/bills` or `/accounting/bills` or `/accounting/bills/:id` --> `/accounting`
- `/invoicing` or `/invoicing/overdue` or `/accounting/invoices/:id` --> `/accounting`
- `/inbox/:emailId` --> `/inbox` (inbox page doesn't support deep-linking to specific emails)
- Any other route --> pass through as-is

## Problem 2: Field employee count shows 0

**Root cause**: The Admin Panel counts employees where `department === "field"` AND `is_active === true`. Database shows:
- "Amiri Tariq" has `department: "field"` but `is_active: false`
- "Tariq Amiri" (a different profile record) has `department: null` and `is_active: true`

There are two separate profile records for the same person. One is field but inactive; the other is active but has no department. This is a data issue, not a code bug.

**Fix**: Update the "Tariq Amiri" profile record in the database to set `department = 'field'` so the count reflects correctly. No code changes needed for this.

---

## Changes

### File: `src/components/panels/InboxPanel.tsx`
- Add a `normalizeRoute()` helper function before the component
- Maps known broken route patterns to valid app routes
- Guards: unknown routes pass through unchanged (no domino effect)
- Update `handleToggle` to call `normalizeRoute(item.linkTo)` before `navigate()`

### Database fix (migration)
- Update the profile for "Tariq Amiri" to set `department = 'field'`
- Single UPDATE, no schema changes

## Technical Detail

```typescript
// Route normalizer (added to InboxPanel.tsx)
function normalizeRoute(linkTo: string): string {
  if (/^\/(bills|invoicing)/.test(linkTo)) return "/accounting";
  if (/^\/accounting\/(bills|invoices)/.test(linkTo)) return "/accounting";
  if (/^\/inbox\/[a-f0-9-]+$/.test(linkTo)) return "/inbox";
  return linkTo;
}
```

| File | Change |
|------|--------|
| `src/components/panels/InboxPanel.tsx` | Add route normalizer to prevent 404 on notification click |
| Database migration | Set Tariq Amiri's department to "field" |
