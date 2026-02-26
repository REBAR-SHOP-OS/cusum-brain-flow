

## Plan: Add Inbox to Sidebar

### Problem
The sidebar (`AppSidebar.tsx`) has no "Inbox" item. The `/inbox-manager` route currently redirects to `/home`, making the email inbox unreachable.

### Changes

**1. Restore `/inbox-manager` route in `src/App.tsx`**
- Line 204: Change `<Navigate to="/home" replace />` back to `<P><InboxManager /></P>` (the import already exists on line 84 area — verify or add)

**2. Add Inbox items to `src/components/layout/AppSidebar.tsx`**
- Add `{ name: "Inbox", href: "/inbox-manager", icon: Inbox, roles: ["admin", "office"], tourId: "nav-inbox" }` to the Office nav group (after Dashboard)
- The Inbox icon is already imported in `Sidebar.tsx` but needs to be added to the AppSidebar import
- The notification bell already exists in the TopBar — no sidebar duplication needed for the panel

**3. Add Inbox to mobile nav in `src/components/layout/MobileNavV2.tsx`**
- Add `{ name: "Inbox", href: "/inbox-manager", icon: Inbox, roles: ["admin", "office"] }` to the `moreItems` array

### Files
- `src/App.tsx` — restore inbox-manager route
- `src/components/layout/AppSidebar.tsx` — add Inbox nav item
- `src/components/layout/MobileNavV2.tsx` — add Inbox to mobile more menu

