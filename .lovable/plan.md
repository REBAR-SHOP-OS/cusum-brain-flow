

## Make zahra@rebar.shop a Super Admin

### Changes

**1. Frontend: `src/lib/accessPolicies.ts`**
- Add `"zahra@rebar.shop"` to `superAdmins` array
- Add `"zahra@rebar.shop"` to `ceoPortalAccess` array
- Remove `"zahra@rebar.shop"` from `blockedFromCustomers` and `blockedFromShopFloor` (super admins bypass all restrictions)

**2. Edge Functions: `supabase/functions/_shared/accessPolicies.ts`**
- Add `"zahra@rebar.shop"` to `SUPER_ADMIN_EMAILS` array

**3. Database: Add admin role**
- Insert `admin` role for zahra's user in `user_roles` table

### Result
- zahra@rebar.shop gets full super admin access identical to radin@rebar.shop
- All route blocks removed, CEO Portal visible, Admin Console accessible

