

## Block Zahra from Shop Floor While Keeping Dashboard Access

### Problem
`zahra@rebar.shop` currently has full internal access (likely via office/admin role). She should be able to see the dashboard (`/home`) but **not** the shop floor routes (`/shop-floor`, `/shopfloor`).

### Changes

**File**: `src/lib/accessPolicies.ts`
- Add a new policy entry: `blockedFromShopFloor: ["zahra@rebar.shop"]`

**File**: `src/components/auth/RoleGuard.tsx`
- Add a block (next to the existing `blockedFromCustomers` check) that redirects `blockedFromShopFloor` users away from `/shop-floor` and `/shopfloor` routes to `/home`

**File**: `src/components/layout/CommandBar.tsx`
- Add `blockedEmails: ["zahra@rebar.shop"]` to the "Shop Floor Hub" command entry so it doesn't appear in her command bar

### Files Changed

| File | Change |
|---|---|
| `src/lib/accessPolicies.ts` | Add `blockedFromShopFloor` list |
| `src/components/auth/RoleGuard.tsx` | Redirect blockedFromShopFloor users away from shop routes |
| `src/components/layout/CommandBar.tsx` | Hide Shop Floor from command bar for Zahra |

