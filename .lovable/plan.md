

# Fix: Menu Access Overrides Not Enforced in Navigation

## Problem
The menu access overrides saved in Vizzy Brain (stored in `user_access_overrides` table) are only used for **display purposes** inside VizzyBrainPanel. The actual sidebar navigation (`AppSidebar.tsx`) calls `getVisibleMenus()` from the hardcoded `userAccessConfig.ts` file — it never checks the database overrides. So changing menu checkboxes in Vizzy Brain has zero effect on what the user actually sees.

## Root Cause
`AppSidebar.tsx` line 225: `const visibleMenus = getVisibleMenus(email)` — this only reads from the static `USER_ACCESS` config object. The `useUserAccessOverrides` hook is never called in the sidebar.

## Fix

### File: `src/components/layout/AppSidebar.tsx`

1. Import and call `useUserAccessOverrides` with the current user's email
2. If the database override has a non-empty `menus` array, use that instead of the hardcoded `getVisibleMenus()` result
3. Fallback to hardcoded config when no database override exists

```
// Before:
const visibleMenus = getVisibleMenus(email);

// After:
const { override } = useUserAccessOverrides(email);
const visibleMenus = override?.menus?.length 
  ? override.menus 
  : getVisibleMenus(email);
```

This is a single-point fix — the `hasAccess` function already uses `visibleMenus` for all filtering, so overriding its source is sufficient.

## Files Modified
| File | Change |
|------|--------|
| `src/components/layout/AppSidebar.tsx` | Use database overrides for menu visibility when available |

## Result
When an admin sets menu access for a user in Vizzy Brain, that user's sidebar will immediately reflect the allowed menus (after page refresh or query invalidation).

