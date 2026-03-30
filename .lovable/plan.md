

# Block zahra@rebar.shop from Shop Floor, Show Home Page

## Problem
`zahra@rebar.shop` is a super admin, so `RoleGuard.tsx` line 58 returns early before the `blockedFromShopFloor` check on line 122 ever runs. She can freely access the shop floor despite being in the blocked list.

## Fix

**File: `src/components/auth/RoleGuard.tsx`**

Move the `blockedFromShopFloor` check (lines 122-125) to **before** the super admin bypass (line 58). This ensures blocked users are redirected to `/home` regardless of super admin status.

```text
BEFORE:
  if (isSuperAdmin) return children;    // line 58 — zahra exits here
  ...
  if (blockedFromShopFloor) → redirect  // line 122 — never reached

AFTER:
  if (blockedFromShopFloor) → redirect  // runs first
  if (isSuperAdmin) return children;    // then super admin bypass
```

One file, one change.

