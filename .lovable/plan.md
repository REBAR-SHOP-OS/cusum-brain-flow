

# Redirect ai@rebar.shop Directly to Shop Floor — Zero Flash

## Problem
When `ai@rebar.shop` logs in or navigates to `/home`, the Home dashboard briefly renders before `RoleGuard` redirects to `/shop-floor`. The user sees the dashboard flash for ~1 second.

## Root Cause
Three places redirect to `/home` without checking if the user is a shopfloor device:
1. `Login.tsx` line 54: `<Navigate to="/home" replace />` after auth
2. `Login.tsx` line 38: `navigate("/home")` after email/password sign-in
3. `Home.tsx` renders its full dashboard before `RoleGuard` kicks in

## Changes

### 1. `src/pages/Login.tsx` — Redirect device accounts directly
- In the `if (user)` check (line 53-54): if user email is in `ACCESS_POLICIES.shopfloorDevices`, redirect to `/shop-floor` instead of `/home`
- In `handleSubmit` success (line 38): same check before `navigate("/home")`
- In Google OAuth success: same check

### 2. `src/pages/Home.tsx` — Early bail for device accounts
- At the top of the component, before any rendering: if `user?.email` is in `ACCESS_POLICIES.shopfloorDevices`, return `<Navigate to="/shop-floor" replace />` immediately
- This is the safety net — even if someone navigates to `/home` directly, they get redirected before any dashboard UI renders

## Files Modified
| File | Change |
|------|--------|
| `src/pages/Login.tsx` | Route device accounts to `/shop-floor` instead of `/home` |
| `src/pages/Home.tsx` | Early redirect before dashboard renders |

## Result
`ai@rebar.shop` never sees the dashboard — not even for a frame. All paths (login, direct URL, OAuth) go straight to `/shop-floor`.

