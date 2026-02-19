
# Fix: To-do Notifications Navigating to /brain Instead of /tasks

## Root Cause (Confirmed via Database + Code Inspection)

Two separate problems combine to cause this bug:

**Problem 1 — Bad data in the database:**
Several to-do notifications have `link_to` set to `/brain` directly. These were inserted incorrectly by agents. When a user clicks them, `normalizeRoute` passes `/brain` through unchanged → user lands on `/brain`.

**Problem 2 — normalizeRoute maps /intelligence → /brain:**
One to-do has `link_to: /intelligence`, which `normalizeRoute` converts to `/brain`. Same wrong result.

## The Fix — Single File, Surgical

**File:** `src/components/panels/InboxPanel.tsx`  
**Change:** Two-line modification in `handleToggle` (around line 221–226)

Currently:
```typescript
const handleToggle = (item: Notification) => {
  if (item.status === "unread") markRead(item.id);
  if (item.linkTo) {
    navigate(normalizeRoute(item.linkTo));
    onClose();
  } else {
    ...
  }
};
```

After fix:
```typescript
const handleToggle = (item: Notification) => {
  if (item.status === "unread") markRead(item.id);
  if (item.linkTo) {
    let dest = normalizeRoute(item.linkTo);
    // To-do items should never land on /brain — fall back to /tasks
    if (item.type === "todo" && dest === "/brain") dest = "/tasks";
    navigate(dest);
    onClose();
  } else {
    ...
  }
};
```

## Why This Approach

- Fixes both the bad-data case (`link_to: /brain`) and the mapped case (`/intelligence` → `/brain`) in one guard
- Does **not** alter `normalizeRoute` itself — other notification types (regular notifications, ideas) that legitimately link to `/brain` remain unaffected
- Scoped to `type === "todo"` only — zero impact on other tabs
- No database changes, no schema changes, no styling changes

## Scope Compliance

| What | Status |
|------|--------|
| `InboxPanel.tsx` — `handleToggle` guard | ONLY change |
| `normalizeRoute` function | Untouched |
| `notifications` / `ideas` tab behavior | Untouched |
| All other files | Untouched |
| Database | Untouched |
