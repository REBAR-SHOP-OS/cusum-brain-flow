

# Fix: Consistent Shopfloor Access for ai@rebar.shop

## Problem
`ai@rebar.shop` still has the `admin` role in the database (the previous deletion didn't take effect). This causes:
- The Home page shows the full admin dashboard instead of the shopfloor-only dashboard
- Admin-only UI panels (CEO Portal, Accounting, Office dashboards) render and fire data fetches that fail with access errors
- Inconsistent behavior: supervisor controls work (they check `isAdmin || isShopSupervisor`) but the whole app treats it as a full admin

## Fix

### 1. Database: Remove `admin` role from ai@rebar.shop
Re-run the deletion properly — keep only `workshop` and `shop_supervisor` roles.

```sql
DELETE FROM public.user_roles
WHERE user_id = (
  SELECT user_id FROM public.profiles WHERE email = 'ai@rebar.shop'
)
AND role = 'admin';
```

### 2. No code changes needed
- `canWrite = isAdmin || isWorkshop` — already works because `isWorkshop` includes `shop_supervisor`
- `canCorrectCount = isAdmin || isShopSupervisor` — already works with `shop_supervisor` alone
- Home page `isWorkshop && !isAdmin` check will now correctly show the shopfloor dashboard
- RoleGuard device-email whitelist is unchanged — route restriction stays

## Result
- Shopfloor supervisor controls: still work (via `shop_supervisor` role)
- Write access on all stations: still works (via `isWorkshop`)
- No more admin-only UI rendering or failed data fetches
- Home page shows shopfloor dashboard cards instead of full admin view

