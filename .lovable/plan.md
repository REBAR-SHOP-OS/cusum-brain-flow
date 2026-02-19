
# Fix: To-Do Notifications Navigating to `/brain`

## Root Cause — Two Bug Locations

### Bug 1 (Primary): `useNotifications.ts` — realtime toast "View" button

**File:** `src/hooks/useNotifications.ts`, line 217

When a new notification arrives via realtime, a toast with a "View" button is shown using:
```ts
onClick: () => { window.location.href = newRow.link_to; }
```

This uses `window.location.href` directly — **it bypasses `normalizeRoute` and the todo-guard entirely**. The 6 active todo records in the database all have `link_to = "/brain"`. When any of them arrives via realtime and the user clicks "View", they land on `/brain`.

### Bug 2 (Secondary): `InboxPanel.tsx` — guard only covers exact `/brain` string

**File:** `src/components/panels/InboxPanel.tsx`, line 226

The existing guard in `handleToggle`:
```ts
if (item.type === "todo" && dest === "/brain") dest = "/tasks";
```

This correctly handles `link_to = "/brain"` for items in the inbox panel. However, the same guard logic does **not** cover `idea` type items, which could also have problematic `link_to` values pointing to deprecated routes.

## The Fix — Two Surgical Changes

### Change 1: `src/hooks/useNotifications.ts`

Extract the same route-normalization and type-guard logic into the toast "View" click handler so it matches the behavior of `handleToggle` in InboxPanel:

**Before (line 215–218):**
```ts
action: newRow.link_to ? {
  label: "View",
  onClick: () => { window.location.href = newRow.link_to; },
} : undefined,
```

**After:**
```ts
action: newRow.link_to ? {
  label: "View",
  onClick: () => {
    let dest = newRow.link_to as string;
    // Normalize legacy routes
    if (/^\/hr(\/|$)/.test(dest)) dest = "/timeclock";
    else if (/^\/estimation(\/|$)/.test(dest)) dest = "/pipeline";
    else if (/^\/(bills|invoicing)(\/|$)/.test(dest)) dest = "/accounting";
    else if (/^\/invoices(\/|$)/.test(dest)) dest = "/accounting";
    else if (/^\/accounting\/(bills|invoices)(\/|$)/.test(dest)) dest = "/accounting";
    else if (/^\/intelligence(\/|$)/.test(dest)) dest = "/brain";
    else if (/^\/inventory(\/|$)/.test(dest)) dest = "/shop-floor";
    else if (/^\/emails(\/|$)/.test(dest)) dest = "/inbox";
    else if (/^\/inbox\/[a-f0-9-]+$/i.test(dest)) dest = "/inbox";
    // To-do items must never land on /brain
    if (newRow.type === "todo" && dest === "/brain") dest = "/tasks";
    window.location.href = dest;
  },
} : undefined,
```

A cleaner implementation is to move `normalizeRoute` out of `InboxPanel.tsx` into a shared utility (e.g., `src/lib/notificationRouting.ts`) and import it from both files. This avoids duplicating the regex map.

### Change 2: `src/components/panels/InboxPanel.tsx`

Move `normalizeRoute` to the shared utility file and import it, keeping `handleToggle` logic identical. This ensures the single source of truth for the route-normalization rules.

## Implementation Plan

### Step 1 — Create shared utility `src/lib/notificationRouting.ts`

```ts
export function normalizeNotificationRoute(linkTo: string, type?: string): string {
  let dest = linkTo;
  if (/^\/hr(\/|$)/.test(dest)) dest = "/timeclock";
  else if (/^\/estimation(\/|$)/.test(dest)) dest = "/pipeline";
  else if (/^\/(bills|invoicing)(\/|$)/.test(dest)) dest = "/accounting";
  else if (/^\/invoices(\/|$)/.test(dest)) dest = "/accounting";
  else if (/^\/accounting\/(bills|invoices)(\/|$)/.test(dest)) dest = "/accounting";
  else if (/^\/intelligence(\/|$)/.test(dest)) dest = "/brain";
  else if (/^\/inventory(\/|$)/.test(dest)) dest = "/shop-floor";
  else if (/^\/emails(\/|$)/.test(dest)) dest = "/inbox";
  else if (/^\/inbox\/[a-f0-9-]+$/i.test(dest)) dest = "/inbox";
  // To-do items must never land on /brain
  if (type === "todo" && dest === "/brain") dest = "/tasks";
  return dest;
}
```

### Step 2 — Update `src/components/panels/InboxPanel.tsx`

- Remove the local `normalizeRoute` function (lines 12–23)
- Import `normalizeNotificationRoute` from `@/lib/notificationRouting`
- Update `handleToggle` to call `normalizeNotificationRoute(item.linkTo, item.type)` instead of the two-step `normalizeRoute` + guard

### Step 3 — Update `src/hooks/useNotifications.ts`

- Import `normalizeNotificationRoute` from `@/lib/notificationRouting`
- Replace the toast "View" `onClick` with:
  ```ts
  onClick: () => {
    const dest = normalizeNotificationRoute(newRow.link_to, newRow.type);
    window.location.href = dest;
  },
  ```

## Scope

| File | Change |
|---|---|
| `src/lib/notificationRouting.ts` | NEW — shared route normalization + todo guard function |
| `src/components/panels/InboxPanel.tsx` | Remove local `normalizeRoute`, import shared utility, simplify `handleToggle` |
| `src/hooks/useNotifications.ts` | Import shared utility, apply in toast "View" `onClick` |

## What Is NOT Changed
- Database schema or data
- Any other component, page, hook, or route
- All other toast logic
- Authentication, permissions, or user role logic
- Any shopfloor, accounting, or other module code
