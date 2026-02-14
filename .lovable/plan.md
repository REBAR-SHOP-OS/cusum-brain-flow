

# Behnam Rajabifar — Role Alignment Between Odoo and Rebar App

## Current State

| System | Roles |
|--------|-------|
| **Odoo** | Administrator in Sales, HR, Manufacturing, Project, Quality, Field Service, and more (37 groups, 999 access rights) |
| **Rebar App** | `sales` only |

## Analysis

Behnam (`ben@rebar.shop`) is a CEO-level user. His Rebar app access is currently **too restrictive** — he can only see Pipeline, Customers, Office, Inbox, and Settings (the `SALES_ALLOWED` routes). He cannot access Shop Floor, Deliveries, Accounting, CEO Portal, Admin Panel, or Diagnostics.

However, following the audit's own recommendation of least privilege, he should **not** get full `admin` rights either. Instead, he needs read-level visibility across the business without the ability to manage system settings or user roles.

## Recommended Rebar App Roles for Behnam

| Role | Reason |
|------|--------|
| `sales` (keep) | Pipeline, Customers, CRM — core to his Sales Administrator Odoo role |
| `office` (add) | Dashboard, Office Tools, Inventory, Live Monitor — gives operational visibility without admin-level system control |

This combination unlocks all operational routes (Dashboard, Pipeline, Customers, Shop Floor, Office Tools, Deliveries, Inventory, Accounting, Live Monitor) while keeping him **out of**:
- Admin Panel (user/role management)
- CEO Portal (reserved for `admin` role)
- Diagnostics / Data Audit (reserved for `admin` role)

If CEO Portal access is needed, that's an `admin`-only route today. A separate decision would be needed to either grant `admin` or create a dedicated `ceo` role.

## Implementation

Single database operation — add the `office` role for `ben@rebar.shop`:

```sql
INSERT INTO user_roles (user_id, role)
SELECT id, 'office'
FROM auth.users
WHERE email = 'ben@rebar.shop'
ON CONFLICT (user_id, role) DO NOTHING;
```

No frontend code changes needed — the existing `RoleGuard`, `AppSidebar`, and `CommandBar` already handle multi-role users correctly.

## What This Unlocks vs. Restricts

**Unlocked routes (with sales + office):**
- Dashboard, Pipeline, Customers, Shop Floor, Office Tools, Deliveries, Inventory, Accounting, Inbox, Tasks, Settings, Live Monitor, Brain, Time Clock, Phone Calls, Agent

**Still restricted:**
- Admin Panel, CEO Portal, Diagnostics — require `admin` role

## Open Question

If Behnam needs CEO Portal access, two options:
1. Grant `admin` role (gives full access including user management)
2. Create a new `ceo` role and update the route guard (more work, better separation)

This can be decided separately. The `office` role addition covers 90% of operational needs immediately.

