

# Restrict `ai@rebar.shop` to Shopfloor Only

## Problem
`ai@rebar.shop` has `admin` + `shop_supervisor` roles (needed for supervisor controls on the shop floor), but the RoleGuard at line 116 sees `isAdmin` and grants full access to every route. Since this is a shared device account dedicated to the shop floor, it should be locked to shopfloor routes only.

## Solution
Add a dedicated email check in `RoleGuard.tsx` **before** the admin bypass (line 116). When the logged-in user is `ai@rebar.shop`, restrict navigation to shopfloor-related routes only — regardless of roles.

### Allowed routes for `ai@rebar.shop`:
```
/shopfloor, /shop-floor, /home, /timeclock, /team-hub, /settings, /tasks, /deliveries
```

### Code change (RoleGuard.tsx, before line 116):
```typescript
// ai@rebar.shop is a shared shopfloor device — lock to shop routes only
const SHOPFLOOR_DEVICE_EMAILS = ["ai@rebar.shop"];
if (SHOPFLOOR_DEVICE_EMAILS.includes(email.toLowerCase())) {
  const DEVICE_ALLOWED = ["/shopfloor", "/shop-floor", "/home", "/timeclock", "/team-hub", "/settings", "/tasks", "/deliveries"];
  const isAllowed = DEVICE_ALLOWED.some((p) => location.pathname.startsWith(p));
  if (!isAllowed) return <Navigate to="/shopfloor" replace />;
  return <>{children}</>;
}
```

This keeps the `admin` + `shop_supervisor` roles active (so the Supervisor button works), but prevents navigating to `/pipeline`, `/customers`, `/accounting`, etc.

