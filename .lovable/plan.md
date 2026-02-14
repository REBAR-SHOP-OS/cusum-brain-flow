

# Add "Shop Supervisor" and "Customer" Roles

## Overview

Add two new roles to the RBAC system: **shop_supervisor** (elevated workshop access) and **customer** (external customer portal access via role instead of just `customer_user_links`).

## Database Migration

Add the two new values to the `app_role` enum:

```sql
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'shop_supervisor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'customer';
```

No new tables needed — both roles use the existing `user_roles` table.

## Frontend Changes

### 1. `src/hooks/useUserRole.ts`

- Add `"shop_supervisor"` and `"customer"` to the `AppRole` type union
- Add convenience booleans: `isShopSupervisor` and `isCustomer`
- `isShopSupervisor` grants workshop access plus additional capabilities
- `isWorkshop` will also be true if user has `shop_supervisor` role (supervisor is a superset)

### 2. `src/components/auth/RoleGuard.tsx`

- Shop Supervisor gets all workshop routes plus access to settings, deliveries, and team management
- Customer role redirects to `/portal` (same as current linked-customer behavior, but now role-based too)

Route access for **shop_supervisor**:
```
/home, /shop-floor, /shopfloor, /timeclock, /team-hub, /settings,
/inbox, /phonecalls, /agent, /tasks, /deliveries
```

Route access for **customer**:
```
/portal (only)
```

### 3. `src/components/layout/MobileNavV2.tsx`

- Add `shop_supervisor` to visibility checks where `workshop` appears
- Customer role users get a minimal nav (just Portal)

### 4. `src/components/settings/SettingsPeople.tsx`

- Add "Shop Supervisor" and "Customer" to the department selector dropdown
- Add icon and color config for both roles:
  - Shop Supervisor: `Shield` icon, purple badge
  - Customer: `Users` icon, cyan badge
- Add "Set as Shop Supervisor" and "Set as Customer" to the role-change dropdown menu

## Summary

| File | Change |
|------|--------|
| Migration SQL | Add `shop_supervisor` and `customer` to `app_role` enum |
| `useUserRole.ts` | Expand type, add `isShopSupervisor`, `isCustomer` |
| `RoleGuard.tsx` | Add route gating for both new roles |
| `MobileNavV2.tsx` | Add role visibility for supervisor, minimal nav for customer |
| `SettingsPeople.tsx` | Add both roles to department picker and action menu |

