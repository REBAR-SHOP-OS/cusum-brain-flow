

# Add Time Clock to Internal Sidebar for Kourosh

## Problem
The Time Clock page (`/timeclock`) is accessible via RoleGuard for workshop users, but the internal sidebar navigation (`navGroups` in `AppSidebar.tsx`) has no "Time Clock" link. Kourosh (`kourosh@rebar.shop`) — an internal workshop user — cannot navigate to Time Clock from the sidebar.

## Solution
Add a "Time Clock" nav item to the sidebar `navGroups` so internal users (especially workshop roles) can see and click it.

## Changes

**File:** `src/components/layout/AppSidebar.tsx`

Add `{ name: "Time Clock", href: "/timeclock", icon: Clock }` to the "Production" group (alongside Shop Floor), with no role restriction so all internal users can access it. This matches the mobile nav which already shows Time Clock for everyone.

```text
Production group (line ~172-177):
  - Shop Floor  (existing)
  - Time Clock  ← NEW
  - Office Tools (existing)
```

Single line addition. No other files need changes — RoleGuard already allows `/timeclock` for workshop users, and `useTimeClock` already works for any user with a profile.

