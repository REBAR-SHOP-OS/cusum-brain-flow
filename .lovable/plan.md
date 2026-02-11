

## Restrict External Employees to Time Clock, Team Hub, and HR Agent

### What Changes

Any logged-in user whose email is NOT `@rebar.shop` and is NOT a linked customer gets locked to exactly 3 features:
1. **Time Clock** (`/timeclock`)
2. **Team Hub** (`/team-hub`)
3. **HR Agent** (`/agent/talent`) -- Scouty, the existing Talent and HR agent

All other routes redirect to `/timeclock` as the default landing page.

### Files to Modify

| File | Change |
|------|--------|
| `src/components/auth/RoleGuard.tsx` | Add `EXTERNAL_EMPLOYEE_ALLOWED` route list (`/timeclock`, `/team-hub`, `/agent/talent`). Before falling through to workshop/role logic, redirect external non-customer users to `/timeclock` if they try to access anything else. |
| `src/components/layout/AppSidebar.tsx` | Detect external employee (non-internal, non-customer). When true, show only Time Clock, Team Hub, and HR Agent nav items -- hide all other groups and items. |
| `src/components/layout/MobileNavV2.tsx` | Same detection. Replace primary nav with just Time Clock, Team Hub, and HR Agent links for external employees. Hide the "More" menu entirely. |

### Technical Details

**RoleGuard.tsx** -- new block inserted after customer check, before role logic:

```
const EXTERNAL_EMPLOYEE_ALLOWED = ["/timeclock", "/team-hub", "/agent/talent"];

// After customer check, before role logic:
if (!isInternal && email && !isLinkedCustomer) {
  const allowed = EXTERNAL_EMPLOYEE_ALLOWED.some(p => location.pathname.startsWith(p));
  if (!allowed) return <Navigate to="/timeclock" replace />;
  return <>{children}</>;
}
```

**AppSidebar.tsx** -- add `useAuth` import, detect `isExternalEmployee`, and when true render a minimal sidebar with only 3 items (Clock, MessageSquare, Users icons).

**MobileNavV2.tsx** -- add `useAuth` + `useCustomerPortalData` imports, detect `isExternalEmployee`, and when true swap `primaryNav` to show only Time Clock, Team Hub, and HR Agent.

### Edge Cases
- Loading states preserved (children shown while customer link loads)
- `/portal` route is outside AppLayout so no conflict
- Internal `@rebar.shop` users completely unaffected
- The HR Agent (Scouty) already exists at `/agent/talent` -- no new agent needed
- External employees can't URL-hack to other agents since RoleGuard blocks `/agent/sales`, `/agent/accounting`, etc.

