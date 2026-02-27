

## Filter Delivery Jobs Out of Pickup Station

### Problem
The Pickup Station page shows ALL completed bundles (cut plans with phase = 'complete'), including ones that are assigned to a delivery route. Only bundles NOT linked to a delivery should appear under "Cleared -- Ready for Pickup."

### Root Cause
Both `PickupStation` and `LoadingStation` use the same `useCompletedBundles()` hook with no filtering. There is no `fulfillment_method` column in the schema, but the `deliveries` table has a `cut_plan_id` foreign key -- if a cut plan has a matching delivery record, it's a delivery job, not a pickup.

### Approach
Rather than adding a new database column, use the existing `deliveries.cut_plan_id` relationship to exclude delivery-assigned bundles from the Pickup Station.

### Changes

**1. `src/hooks/useCompletedBundles.ts` -- Add optional filter parameter**
- Add an optional `exclude` parameter: `'delivery' | 'pickup' | undefined`
- When `exclude = 'delivery'`: after fetching completed bundles, also query `deliveries` table for all `cut_plan_id` values, then filter out bundles whose `cutPlanId` appears in that set
- This keeps the hook reusable for both pages

Alternatively (simpler): add a `pickupOnly` boolean parameter. When true, fetch delivery `cut_plan_id`s and exclude those bundles.

**2. `src/pages/PickupStation.tsx` -- Pass the filter**
- Change `useCompletedBundles()` to `useCompletedBundles({ pickupOnly: true })` so only non-delivery bundles appear

**3. No changes to `LoadingStation.tsx`**
- The Loading Station continues to show all completed bundles (or could be updated separately if needed)

### Implementation Detail

In `useCompletedBundles`, when `pickupOnly` is true:

```typescript
// After fetching cut_plan_items, also fetch delivery-linked plan IDs
const { data: deliveryPlans } = await supabase
  .from("deliveries")
  .select("cut_plan_id")
  .eq("company_id", companyId!)
  .not("cut_plan_id", "is", null);

const deliveryPlanIds = new Set(
  (deliveryPlans ?? []).map(d => d.cut_plan_id)
);

// Filter out bundles linked to deliveries
return bundles.filter(b => !deliveryPlanIds.has(b.cutPlanId));
```

### No Database Changes
- No new columns or migrations needed
- Uses existing `deliveries.cut_plan_id` relationship
- Single additional lightweight query when `pickupOnly` is true
