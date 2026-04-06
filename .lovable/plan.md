

# Fix: Manual Publish Blocked by Role Check

## Problem
When clicking "Publish Now" manually, the `social-publish` edge function returns **403: "Forbidden: requires one of [admin, marketing] roles"**. The user performing the publish (likely Neel or another approver) doesn't have the `admin` or `marketing` role in the `user_roles` table, even though they have approval authority.

The **cron auto-publish** is unaffected (it uses `internalOnly: true` with no auth), but manual publish from the UI is blocked.

## Root Cause
`supabase/functions/social-publish/index.ts` line 482:
```typescript
requireAnyRole: ["admin", "marketing"],
```
This blocks any user without those specific roles from manually publishing, even if they are a super admin (sattar/radin) or an authorized approver.

## Fix

### File: `supabase/functions/social-publish/index.ts`

**Remove the `requireAnyRole` restriction** from the function options and instead implement a smarter check inside the handler body that respects the existing super admin bypass:

1. Remove `requireAnyRole: ["admin", "marketing"]` from the options (line 482)
2. Add an inline role + super-admin check at the top of the handler:
   - Allow if user has `admin` or `marketing` role
   - Allow if user email is in `SUPER_ADMIN_EMAILS` (sattar/radin)
   - Otherwise return 403

This ensures super admins and authorized approvers can always publish manually, while still preventing unauthorized users from accessing the endpoint.

## Impact
- Only modifies the authorization logic in `social-publish` — no publishing behavior changes
- Super admins (sattar, radin) can always publish manually
- Users with `admin` or `marketing` roles can publish as before
- Cron auto-publish is completely unaffected (different function)

## Files Changed
- `supabase/functions/social-publish/index.ts` — replace rigid `requireAnyRole` with flexible role + super-admin check

