

## Fix: Group Work Order Queue by Customer Name instead of Workstation

### Problem
The Work Order Queue in `WorkOrderQueueSection.tsx` groups work orders by `wo.workstation`, but this field is always `null` in the database. This causes all work orders to appear under a single "UNASSIGNED" header, even though the customer name is available on each work order.

### Solution
Change the grouping key from `wo.workstation` to `wo.customer_name`, falling back to "Unassigned" only when no customer name exists.

### File: `src/components/shopfloor/WorkOrderQueueSection.tsx`

**Line 30** — change grouping key:
```typescript
// Before
const key = wo.workstation || "Unassigned";

// After
const key = wo.customer_name || "Unassigned";
```

That's the only change needed. The `customer_name` field is already populated by the `useSupabaseWorkOrders` hook (via the `orders → customers` join). The group header will now display "Valard Construction LP" instead of "UNASSIGNED".

