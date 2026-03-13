

# Remove Dashboard Icon from Sidebar for ai@rebar.shop

## Problem
The ai@rebar.shop kiosk account currently shows a Home/Dashboard icon (circled in red) in the sidebar. This device should not have it — it's a dedicated shopfloor kiosk.

## Solution

### `src/components/layout/AppSidebar.tsx`
Remove the `Dashboard` entry from the `aiNav` array (line 46). The remaining items will be Kiosk and Shop Floor only.

Also update the RoleGuard default redirect for this account from `/shopfloor` to `/shop-floor` if needed (already correct).

