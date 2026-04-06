

# Fix: ai@rebar.shop 404 — Wrong Redirect Path

## Root Cause

In `RoleGuard.tsx` (line ~138), shopfloor device accounts are redirected to `/shopfloor` when they access a non-allowed route. But the Shop Floor page route is `/shop-floor` (with a hyphen). `/shopfloor` has no route definition — only sub-routes like `/shopfloor/station`, `/shopfloor/pool`, etc. exist. So the redirect hits the `*` catch-all → NotFound → 404.

## Fix

### File: `src/components/auth/RoleGuard.tsx`

Change the redirect target from `/shopfloor` to `/shop-floor`:

```typescript
// Line ~140: Change
if (!isAllowed) return <Navigate to="/shopfloor" replace />;
// To
if (!isAllowed) return <Navigate to="/shop-floor" replace />;
```

Also fix the same issue for external shop supervisors (line ~111):
```typescript
// Change
if (!isAllowed) return <Navigate to="/shop-floor" replace />;
// Already correct — confirm no other /shopfloor redirects
```

And fix the internal shop supervisor redirect (line ~157):
```typescript
// Change
return <Navigate to="/shop-floor" replace />;
// Already correct — confirm
```

### Verification

Only **one** redirect is broken — the `shopfloorDevices` block redirecting to `/shopfloor` instead of `/shop-floor`.

## Impact
- Fixes the 404 for `ai@rebar.shop` on login
- User will now correctly land on the Shop Floor page
- No other users or routes affected

