

# Grant Shop Supervisor Access to kourosh@rebar.shop

## Context
Kourosh Zand (kourosh@rebar.shop) has two profile records but **zero roles** assigned. As a shop supervisor, he needs broad operational access covering both the workshop floor and office management tools.

## Roles to Assign

Both profile IDs will receive roles to avoid access gaps (the newer profile `7cf45e86` appears to be the active one):

| Role | Purpose |
|------|---------|
| **workshop** | Access to Shop Floor, Station Views, Time Clock |
| **office** | Access to Office Portal, Production Queues, Inventory, Deliveries |

These two roles combined give a supervisor full operational visibility without admin-level privileges (no access to Admin Panel, and accounting stays restricted).

## Accessible Routes After Change

- /home (Dashboard)
- /shop-floor (Shop Floor + Station Views)
- /timeclock (Time Clock)
- /team-hub (Team Hub)
- /inbox (Inbox)
- /phonecalls (Phone Calls)
- /office (Office Portal)
- /deliveries (Deliveries)
- /customers (Customers)
- /brain (Brain)
- /integrations (Integrations)
- /settings (Settings)
- /tasks (Tasks)

## Technical Steps

1. **Insert roles** into `user_roles` table for both profile IDs:
   - `(user_id: 7cf45e86-..., role: workshop)`
   - `(user_id: 7cf45e86-..., role: office)`
   - `(user_id: 5f7bed8c-..., role: workshop)`
   - `(user_id: 5f7bed8c-..., role: office)`

2. **No code changes** -- the existing `RoleGuard` and `AppSidebar` components already handle these roles correctly.

