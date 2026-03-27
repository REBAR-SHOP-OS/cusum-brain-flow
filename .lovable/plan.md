

# Remove Dashboard Access for ai@rebar.shop

## Problem
The `ai@rebar.shop` device account currently has access to `/home` (dashboard) via the `RoleGuard` allowed routes list and can see the full dashboard UI. This account is a shared shopfloor kiosk device — it should only access kiosk and shop floor routes.

## Changes

### 1. `src/components/auth/RoleGuard.tsx`
- Line 137: Remove `/home` from the `DEVICE_ALLOWED` array
- Change: `["/shopfloor", "/shop-floor", "/home", "/timeclock", ...]` → `["/shopfloor", "/shop-floor", "/timeclock", "/team-hub", "/settings", "/tasks", "/deliveries"]`
- When `ai@rebar.shop` tries to access `/home`, it will be redirected to `/shopfloor`

### 2. `src/components/layout/AppSidebar.tsx`
- Already correct — the sidebar for `ai@rebar.shop` only shows "Kiosk" and "Shop Floor" (no Dashboard link). No change needed here.

## Result
- `ai@rebar.shop` is blocked from `/home` dashboard
- Attempting to visit `/home` redirects to `/shopfloor`
- Sidebar remains unchanged (already has no Dashboard link)

## Files Changed
- `src/components/auth/RoleGuard.tsx` — remove `/home` from device-allowed routes

