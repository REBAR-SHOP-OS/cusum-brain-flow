

# Fix: Grant neel@rebar.shop Access to Office Portal

## Problem
`neel@rebar.shop` (user ID: `a94932c5-e873-46fd-9658-dc270f6f5ff3`) has **zero roles** in the `user_roles` table. The Office portal gate requires `isAdmin` or `isOffice` (which checks for `office`, `sales`, or `accounting` roles). Without any role, the user sees "Access Restricted" and never reaches the Order Calculator upload.

## Fix
Run a database migration to insert the `sales` role for this user. Based on `src/lib/vizzyContext.ts`, Neel Mahajan is the Sales Manager, so `sales` is the correct role.

### Migration SQL
```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('a94932c5-e873-46fd-9658-dc270f6f5ff3', 'sales')
ON CONFLICT (user_id, role) DO NOTHING;
```

### Result
- `useUserRole()` → `isOffice` returns `true` (since `sales` is included)
- Office portal renders normally
- Order Calculator upload works (it's client-side FileReader, no server permissions needed)

### Files changed
| File | Change |
|------|--------|
| Database migration | Insert `sales` role for neel@rebar.shop |

No code changes needed — the issue is purely a missing database role assignment.

