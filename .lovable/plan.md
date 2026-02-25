

## Audit: Saurabh's Dashboard Instability

### Root Cause

Saurabh (`saurabh@rebar.shop`) has **zero roles** in the `user_roles` table — in both test and production environments. This means:

1. **In `RoleGuard`**: Every check fails (`isAdmin` false, `hasOfficeAccess` false, `isCustomer` false, `isSalesOnly` false, `isShopSupervisor` false), so execution falls through to the **bottom catch-all** (line 142-148) which treats him as a workshop-only user and redirects to `/shop-floor` for any route not in `WORKSHOP_ALLOWED`.

2. **On `/home`**: The route is in `WORKSHOP_ALLOWED`, so he is allowed through. But if he navigates anywhere else (like clicking a dashboard link), he gets bounced to `/shop-floor`.

3. **The "instability"**: The `/home` page renders, but since `isWorkshop` is also false (no roles at all), neither the shopfloor Command Hub nor the full dashboard may render correctly depending on the component's assumptions. Any navigation attempt gets caught by the guard and redirected.

### Fix: Two-Part

#### Part 1 — Assign roles to Saurabh (Data fix)

Saurabh needs proper roles. Based on the original report mentioning he should have `workshop`, `office`, and `sales` roles:

- Insert roles `workshop`, `office`, and `sales` for user `f919e8fa-4981-42f9-88c9-e1e425687522` into the `user_roles` table in **both test and production**.

#### Part 2 — Harden `RoleGuard` for zero-role internal users (Code fix)

The catch-all currently treats any internal user with no recognized roles as a workshop user, which is incorrect. Internal users with no roles should get access to `/home` at minimum, not be funneled into the workshop restriction path.

**File: `src/components/auth/RoleGuard.tsx`**, before the final workshop catch-all (line 142):

Add a guard for internal users with no roles:
```typescript
// Internal user with no roles assigned — allow basic access rather than
// treating them as workshop-only (which redirects to /shop-floor)
if (roles.length === 0) {
  return <>{children}</>;
}
```

This prevents the zero-role catch-all redirect and lets the page components handle the empty-role state gracefully.

### Files Changed
1. `src/components/auth/RoleGuard.tsx` — add zero-role guard before workshop catch-all
2. Database — insert missing roles for Saurabh in both environments

