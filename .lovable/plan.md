

# Block zahra@rebar.shop from Customers

## What This Does
Hides the "Customers" menu item and blocks route access for `zahra@rebar.shop`.

## Changes

### 1. Add `blockedEmails` to nav items
In **AppSidebar.tsx**, **MobileNavV2.tsx**, and **CommandBar.tsx**:
- Add `blockedEmails: ["zahra@rebar.shop"]` to the Customers nav item
- Update `hasAccess` / `isVisible` functions to check `blockedEmails` and return false if the current user's email is in the list

### 2. Block the route in RoleGuard.tsx
- Add a check: if user email is `zahra@rebar.shop` and path starts with `/customers`, redirect to `/home`

### Files
- `src/components/layout/AppSidebar.tsx` — add `blockedEmails` to Customers item + update `hasAccess`
- `src/components/layout/MobileNavV2.tsx` — add `blockedEmails` to Customers item + update `isVisible`
- `src/components/layout/CommandBar.tsx` — add `blockedEmails` to Customers item + filter logic
- `src/components/auth/RoleGuard.tsx` — block `/customers` route for `zahra@rebar.shop`

