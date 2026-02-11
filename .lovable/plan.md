

## Restrict Kourosh to Shop Floor Only (No CRM Access)

### Problem
`kourosh@rebar.shop` currently has no `user_id` linked in the profiles table and no roles assigned, which means RoleGuard lets them through to everything. They should only have **workshop** access (Shop Floor, Time Clock, Team Hub, etc.) -- no CRM, Accounting, or Pipeline.

### Steps

**1. Link the profile to the auth account**
- Update the existing profile record to set `user_id = 'efa543f5-0f1b-4cee-b806-4176d996e9a6'`

**2. Assign the `workshop` role**
- Insert a row into `user_roles` with `user_id = 'efa543f5-...'` and `role = 'workshop'`

### Result
Once linked and assigned:
- RoleGuard will restrict Kourosh to: `/home`, `/shop-floor`, `/timeclock`, `/team-hub`, `/settings`, `/inbox`, `/phonecalls`, `/agent`, `/tasks`
- Attempting to visit `/pipeline`, `/customers`, `/accounting`, or any other restricted route will redirect to `/shop-floor`
- The sidebar will show locked indicators on restricted modules

### Technical Details
- Two SQL `UPDATE`/`INSERT` statements executed via the data tools (no schema changes needed)
- The `user_roles` table and `has_role` function already exist
- The `workshop` role is already defined in the `app_role` enum
