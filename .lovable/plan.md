

# Fix: Remove Admin Role from ai@rebar.shop to Stop Access Errors

## Problem
`ai@rebar.shop` has the `admin` role in the database. This causes dozens of UI components to render admin-only features (CEO Portal, Accounting panels, Office dashboards, etc.) that try to fetch data the shopfloor device shouldn't access — resulting in constant access errors.

## Root Cause
The `admin` role was originally added so supervisor controls would work, but those controls already check `isAdmin || isShopSupervisor` — so `shop_supervisor` alone is sufficient.

## Fix

### 1. Database: Remove `admin` role from ai@rebar.shop
```sql
DELETE FROM public.user_roles 
WHERE user_id = (SELECT user_id FROM profiles WHERE email = 'ai@rebar.shop') 
AND role = 'admin';
```
Keeps `workshop` and `shop_supervisor` roles — all shopfloor supervisor buttons continue to work.

### 2. Code: Remove ai@rebar.shop from CEO Portal nav
In `src/components/layout/MobileNavV2.tsx`, remove `ai@rebar.shop` from the CEO Portal `allowedEmails` list.

## What stays working
- All shopfloor supervisor controls (`isShopSupervisor` check passes)
- RoleGuard route restriction (unchanged — device-email whitelist)
- Vizzy button (controlled by `useSuperAdmin`, not roles)

## What stops breaking
- No more admin-only UI panels loading and failing
- No more unauthorized data fetch errors

