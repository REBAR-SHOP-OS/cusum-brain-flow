

# Fix: CEO Dashboard Not Showing for Super Admin

## Problem Analysis

After reviewing all the code, I found **two issues**:

### Issue 1: Desktop Sidebar (`AppSidebar.tsx`) Missing Super Admin Bypass
The `hasAccess()` function in `AppSidebar.tsx` (line 194) does NOT import or use `useSuperAdmin`. While `sattar@rebar.shop` is in the `allowedEmails` lists for "Live Monitor" and "Accounting", other role-gated items depend on the database `admin` role loading first. If there's any delay, items won't show.

The same `isSuperAdmin` bypass that was added to `MobileNavV2` needs to be added to `AppSidebar`.

### Issue 2: `RoleGuard` Also Missing Super Admin Bypass
The `RoleGuard` component controls route access but has no super admin bypass. It relies entirely on database roles. If roles haven't loaded yet or there's a timing issue, `sattar@rebar.shop` could be redirected away from pages. Adding `if (isSuperAdmin) return children` early in `RoleGuard` ensures super admins are never blocked.

## Solution

### Change 1: Add super admin bypass to `AppSidebar.tsx`
- Import `useSuperAdmin` hook
- Call `const { isSuperAdmin } = useSuperAdmin()` 
- Add `if (isSuperAdmin) return true` at top of `hasAccess()` function

### Change 2: Add super admin bypass to `RoleGuard.tsx`
- Import `useSuperAdmin` hook
- After getting `isSuperAdmin`, add early return: `if (isSuperAdmin) return <>{children}</>` before any redirect logic
- This ensures super admins are never redirected away from any route

Both changes mirror what was already done for `MobileNavV2` — extending the same pattern to the desktop sidebar and route guard.

