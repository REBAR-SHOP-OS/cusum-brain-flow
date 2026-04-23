

## Plan — Restore full Production Queue visibility for kourosh@rebar.shop

### Root cause (verified live in DB)
Three data defects on his account, all required for the Production Queue list to populate:

| Defect | Current | Required |
|---|---|---|
| `profiles.user_id` | `NULL` | `efa543f5-0f1b-4cee-b806-4176d996e9a6` |
| `profiles.is_active` | `false` | `true` |
| `user_roles` | `workshop` only | `workshop` + `shop_supervisor` |

Because `profiles.user_id` is NULL, `useCompanyId()` returns `null` → `useProjects(companyId)` returns `[]` → `ShopFloorProductionQueue` has no `projectIds` → list is empty. The header counters ("143 items", "40 pool") come from a separate hook that doesn't filter by projects, which is why those still show.

`is_active = false` will additionally exclude him from operator dropdowns. Missing `shop_supervisor` blocks supervisor overrides (machine unlock, cross-project admin actions) which a "shop administrator" needs.

### Fix — three data operations, no code changes

```sql
-- 1. Link his profile to his auth user (fixes companyId resolution → unblocks every query)
UPDATE public.profiles
SET user_id = 'efa543f5-0f1b-4cee-b806-4176d996e9a6',
    is_active = true,
    updated_at = now()
WHERE email = 'kourosh@rebar.shop';

-- 2. Grant shop administrator role
INSERT INTO public.user_roles (user_id, role)
VALUES ('efa543f5-0f1b-4cee-b806-4176d996e9a6', 'shop_supervisor')
ON CONFLICT (user_id, role) DO NOTHING;
```

### Verification (run after)
```sql
SELECT p.user_id, p.email, p.company_id, p.is_active,
       array_agg(ur.role) AS roles
FROM profiles p
LEFT JOIN user_roles ur ON ur.user_id = p.user_id
WHERE p.email = 'kourosh@rebar.shop'
GROUP BY p.user_id, p.email, p.company_id, p.is_active;
-- expect: user_id = efa543f5-..., is_active = true, roles = {workshop, shop_supervisor}
```

### Result
| Surface | Before | After |
|---|---|---|
| `useCompanyId()` | `null` | `a0000000-...-001` |
| `useProjects()` | `[]` | all 19 customer projects |
| Production Queue list (bottom of Station Dashboard) | empty | all customers + barlists + cut plans |
| Pool / Clearance / Loading / Pickup / Cutter / Inventory | empty | populated |
| MyJobsCard | empty | shows assignments |
| Operator assignment dropdowns | excluded | included |
| Machine unlock / supervisor override | denied | allowed |
| Sidebar menus | Shop Floor / Time Clock / Team Hub | unchanged |

### Out of scope
- No frontend code changes — `useCompanyId`, `useProjects`, RLS, and `userAccessConfig.ts` are all correct.
- Other orphan profile rows untouched (surgical scope).
- Menu restriction from prior approved plan stays intact.

### Files touched
None. Three database operations only (1 UPDATE setting two columns, 1 INSERT).

