

# Fix: Give radin@rebar.shop Access to Vizzy Button

## Problem
Line 90 of `AppLayout.tsx` restricts the floating Vizzy button to only `sattar@rebar.shop`. Per memory, radin@rebar.shop is a Super Admin and should have Vizzy access.

## Fix

**File: `src/components/layout/AppLayout.tsx`** — Line 90

Change:
```tsx
{(user?.email === "sattar@rebar.shop" || isAppBuilderDashboard) && <FloatingVizzyButton />}
```

To:
```tsx
{((user?.email === "sattar@rebar.shop" || user?.email === "radin@rebar.shop") || isAppBuilderDashboard) && <FloatingVizzyButton />}
```

Single line change, no other files affected. The backend `admin-chat` edge function already whitelists radin@rebar.shop as a super admin, so no backend changes needed.

