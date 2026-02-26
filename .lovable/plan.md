

## Problem

The packing slip's "Customer" field shows the project/scope name (e.g., "Masonary Wall") instead of the actual customer name. This happens in two places:

1. **`useDeliveryActions.ts` line 131**: `customer_name: bundle.projectName` — persists the wrong value to `packing_slips` table
2. **`PickupStation.tsx` lines 98, 115**: `customerName={selectedBundle.projectName}` — passes the wrong value to the slip preview

**Root cause**: `bundle.projectName` comes from `cut_plans.project_name` which is the project/scope name. The actual customer name lives in `projects.customer_id → customers.name`.

## Fix

### 1. `src/hooks/useCompletedBundles.ts`
- Expand the query to join through `cut_plans → projects → customers`:
  ```
  cut_plans!inner(id, name, project_name, company_id, project_id,
    projects(customer_id, customers(name)))
  ```
- Add a `customerName` field to `CompletedBundle` resolved from `customers.name`
- Keep `projectName` as-is (it's used correctly elsewhere as the project label)

### 2. `src/hooks/useDeliveryActions.ts` (line 131)
- Change `customer_name: bundle.projectName` → `customer_name: bundle.customerName || bundle.projectName`
- This uses the real customer name when available, falls back to project name

### 3. `src/pages/PickupStation.tsx` (lines 98, 115)
- Change `customerName={selectedBundle.projectName}` → `customerName={selectedBundle.customerName || selectedBundle.projectName}`

