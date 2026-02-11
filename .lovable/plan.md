

## Auto-Route External Users to the Right Portal

### What This Does

Any user whose email is NOT `@rebar.shop` gets automatically redirected:
- **If they're a linked customer** (have a `customer_user_links` record) → sent to `/portal` (Customer Portal)
- **If they're an external employee** (no customer link, have workshop/field role) → existing RoleGuard already locks them to shop floor routes

### Where the Check Goes

**`src/components/auth/RoleGuard.tsx`** — this is already the routing decision-maker. We add one check at the top, before role logic:

```
1. Get user email from auth
2. If email ends with @rebar.shop → skip (internal staff, proceed to role checks)
3. If external email → query customer_user_links
   - If customer link exists → Navigate to /portal
   - If no customer link → fall through to existing workshop/role logic
```

### Why RoleGuard (not ProtectedRoute)

- RoleGuard already imports `useAuth` and handles route decisions
- ProtectedRoute is intentionally simple (auth yes/no only)
- CustomerPortal at `/portal` is outside AppLayout/RoleGuard, so no infinite redirect loop

### Technical Changes

| File | Change |
|------|--------|
| `src/components/auth/RoleGuard.tsx` | Add email domain check + `useCustomerPortalData` hook to detect customer users and redirect to `/portal` |

### Edge Cases Handled
- Loading states: show children while customer link query loads (avoids flash)
- `/portal` route is outside `AppLayout` so RoleGuard never runs there — no redirect loop
- Internal `@rebar.shop` users are completely unaffected
- External employees without customer links fall through to normal workshop role restrictions

