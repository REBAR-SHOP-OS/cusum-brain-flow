

## Fix RLS DELETE Policies for Production Queue

### Problem
Deleting projects/barlists from the Production Queue fails because:
1. **`work_orders`** DELETE policy only works when `order_id` is set (joins through `orders` table). Production Queue work orders use `project_id`/`barlist_id` and may have `order_id = NULL`.
2. **`clearance_evidence`** has NO DELETE policy at all -- any attempt to delete clearance evidence rows is blocked.

### Fix: One SQL Migration

Create a migration that:

**1. Replace `work_orders` DELETE policy** to also allow deletion when the work order is linked via `project_id` or `barlist_id` (not just `order_id`):

```sql
DROP POLICY "Admins can delete work_orders" ON public.work_orders;

CREATE POLICY "Admins can delete work_orders" ON public.work_orders
FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND (
    -- Via order
    EXISTS (SELECT 1 FROM orders o WHERE o.id = work_orders.order_id AND o.company_id = get_user_company_id(auth.uid()))
    OR
    -- Via project
    EXISTS (SELECT 1 FROM projects p WHERE p.id = work_orders.project_id AND p.company_id = get_user_company_id(auth.uid()))
    OR
    -- Via barlist
    EXISTS (SELECT 1 FROM barlists b WHERE b.id = work_orders.barlist_id AND b.company_id = get_user_company_id(auth.uid()))
  )
);
```

**2. Add `clearance_evidence` DELETE policy**:

```sql
CREATE POLICY "Admin and workshop can delete clearance evidence"
ON public.clearance_evidence
FOR DELETE TO authenticated
USING (
  has_any_role(auth.uid(), ARRAY['admin'::app_role, 'workshop'::app_role])
);
```

### No Frontend Changes Needed
The deletion code in `ProductionQueueView.tsx` is already correct -- it just needs the database policies to allow the operations.
