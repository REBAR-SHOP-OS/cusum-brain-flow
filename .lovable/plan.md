

# Add Kiosk Shortcut for ai@rebar.shop

## What
Add a "Kiosk" nav item in the sidebar **only for `ai@rebar.shop`**, placed right after "Dashboard". Clicking it navigates to `/timeclock?kiosk=1` which auto-enters Kiosk mode.

## Changes

### 1. `src/components/layout/AppSidebar.tsx`
Add a new item to the `aiNav` array:
```ts
{ name: "Kiosk", href: "/timeclock?kiosk=1", icon: Maximize }
```
Import `Maximize` from lucide-react (same icon used on the Kiosk button in TimeClock).

### 2. `src/pages/TimeClock.tsx`
Read `?kiosk=1` from URL on mount. If present, auto-trigger `enterKioskMode()` after camera/face hook is ready.
```ts
import { useSearchParams } from "react-router-dom";
const [searchParams] = useSearchParams();

useEffect(() => {
  if (searchParams.get("kiosk") === "1") {
    enterKioskMode();
  }
}, []); // once on mount
```

### Scope
- **Only** `ai@rebar.shop` sidebar is touched (the early-return block at line 44).
- No other users, routes, or components are affected.
- No database changes.

