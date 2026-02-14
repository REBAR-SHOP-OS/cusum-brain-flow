

# Role-Based External Employee Access

## Overview

Replace the current blanket external-employee lockdown (Time Clock + Team Hub + HR Agent only) with role-aware routing. External users will get access based on their assigned role, with tighter restrictions than internal users.

## Access Matrix

| External User Type | Allowed Routes |
|---|---|
| Workshop employee | `/timeclock`, `/team-hub` only |
| Shop Supervisor | `/timeclock`, `/team-hub`, `/shop-floor`, `/shopfloor`, `/home`, `/inbox`, `/tasks`, `/deliveries`, `/settings` |
| Karthick (office) | `/timeclock`, `/team-hub`, `/pipeline` (his kanban column only) |
| Customer (role) | `/portal` only |
| Customer (linked) | `/portal` only (existing behavior) |

## Changes

### 1. `src/components/auth/RoleGuard.tsx`

Replace the current hardcoded external employee block (lines 62-79) with role-aware routing:

- Check if user has roles loaded
- **Customer role or linked customer**: redirect to `/portal` (unchanged)
- **Workshop role (external)**: allow only `/timeclock` and `/team-hub`
- **Shop Supervisor role (external)**: allow workshop routes + `/deliveries`, `/shop-floor`, etc.
- **Office role (external, i.e. Karthick)**: allow `/timeclock`, `/team-hub`, `/pipeline`
- **No role assigned**: default to `/timeclock` only (safe fallback)

### 2. `src/components/layout/AppSidebar.tsx`

Update the external employee sidebar (lines 42-81) to be role-aware:

- **External workshop**: show Time Clock, Team Hub (2 items)
- **External shop supervisor**: show Home, Shop Floor, Deliveries, Time Clock, Team Hub, Tasks
- **External office (Karthick)**: show Pipeline, Time Clock, Team Hub

### 3. `src/components/layout/MobileNavV2.tsx`

Update the external employee nav (lines 74-101) with the same role-aware logic as the sidebar.

### 4. Pipeline page restriction for Karthick

No code change needed on the Pipeline page itself -- the existing kanban already filters by stage. Karthick will see all visible stages but can only interact (download, upload, notes, comments) based on existing RLS policies. If you want to restrict his Pipeline view to only the "estimation_karthick" column, that would require a separate UI filter, which I can add.

## What stays unchanged

- Internal user routing (all existing role checks)
- Customer portal page and data hooks
- RLS policies on database tables
- All other pages and components

## Technical Notes

- External user detection remains: `!email.endsWith("@rebar.shop")`
- The `useUserRole` hook already loads roles for all authenticated users regardless of domain, so no backend changes needed
- The roles (`workshop`, `shop_supervisor`, `office`) must be assigned to external users via the Settings People page

