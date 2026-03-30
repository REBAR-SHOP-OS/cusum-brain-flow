

# Harden ai@rebar.shop Access Restrictions

## Current State
- **Sidebar**: Already shows only Kiosk + Shop Floor ✓
- **RoleGuard**: Already redirects non-shopfloor routes to `/shopfloor` ✓
- **Vizzy toggle**: Hidden behind `isSuperAdmin` check (ai@ is not super admin) ✓

## Gaps to Fix

### 1. IntelligencePanel hard block for ai@rebar.shop
The `IntelligencePanel` component in `AppLayout.tsx` renders without a user check. If the workspace state `intelligencePanelOpen` were ever set to `true` (e.g. programmatically, via DevTools), Vizzy would appear. Add an explicit block inside `IntelligencePanel.tsx` to return `null` when user is `ai@rebar.shop`.

### 2. Default landing route → `/shop-floor`
Currently when `ai@rebar.shop` navigates to `/` or `/home`, RoleGuard redirects to `/shopfloor`. Ensure the root route also redirects correctly. No change needed if `/` already goes through RoleGuard — but we should verify and add an explicit redirect in the App router if the root path bypasses RoleGuard.

## Files to Change

### `src/components/layout/IntelligencePanel.tsx`
- Import `useAuth` 
- At the top of the component, check if `user?.email === "ai@rebar.shop"` → return `null`
- This is a defense-in-depth measure ensuring Vizzy can never render for this device account

### `src/components/auth/RoleGuard.tsx`  
- Verify the existing shopfloor device block also covers `/home` and `/` redirects (it does — line 140 redirects to `/shopfloor` for any non-allowed path) ✓ No change needed.

**Summary**: Single file edit to `IntelligencePanel.tsx` adding a hard block. The rest of the restrictions are already correctly implemented.

