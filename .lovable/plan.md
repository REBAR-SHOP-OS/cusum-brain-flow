

## Audit: Saurabh can't see the dashboard

### Root Cause

In `src/pages/Home.tsx` line 136:

```typescript
if (isWorkshop && !isAdmin) {
```

Saurabh has **three roles**: `workshop`, `office`, `sales`. The `isWorkshop` flag is `true` (he has the workshop role) and `isAdmin` is `false` (he doesn't have the admin role). So this condition evaluates to `true`, and he gets the **shopfloor-only dashboard** (the "SELECT INTERFACE" / Command Hub view) instead of the full office dashboard with agents, workspaces, and helpers.

The guard only exempts `admin` users from the shopfloor view, but it should also exempt users who have office or sales roles.

### Fix

**File: `src/pages/Home.tsx`, line 136**

Change:
```typescript
if (isWorkshop && !isAdmin) {
```
To:
```typescript
if (isWorkshop && !isAdmin && !hasRole("office") && !hasRole("sales") && !hasRole("accounting")) {
```

This ensures that any user with an elevated role (office, sales, accounting, or admin) sees the full dashboard, even if they also have the workshop role. Workshop-only users still get the shopfloor Command Hub.

### Files Changed
1. `src/pages/Home.tsx` — one line change (line 136)

