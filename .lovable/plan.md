

# Add Team Hub to ai@rebar.shop Sidebar

## Current State
- `ai@rebar.shop` sidebar only shows **Kiosk** and **Shop Floor** (AppSidebar.tsx line 70-73)
- RoleGuard already allows `/team-hub` for this account (line 138) and redirects to `/shopfloor` for non-allowed routes — so the default landing page is already shop-floor
- No changes needed for default page — it already works

## Fix

### File: `src/components/layout/AppSidebar.tsx` (lines 70-73)

Add Team Hub to the `aiNav` array:

```typescript
const aiNav: NavItem[] = [
  { name: "Kiosk", href: "/timeclock?kiosk=1", icon: Maximize },
  { name: "Shop Floor", href: "/shop-floor", icon: Factory },
  { name: "Team Hub", href: "/team-hub", icon: Users },
];
```

Import `Users` from lucide-react (likely already imported).

## Impact
- Only adds one nav item to the ai@rebar.shop sidebar
- No other users or routes affected
- Team Hub access is already permitted by RoleGuard

