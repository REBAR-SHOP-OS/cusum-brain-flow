

## Fix: Loading Station Should Only Show Cleared Items

### Problem
The Loading Station (`/shopfloor/loading`) displays ALL bar marks from the cut plan, including items that haven't been cleared yet (e.g., A1001, A1002 circled in the screenshot). Only items with phase "clearance" or "complete" should appear.

### Root Cause
In `src/pages/LoadingStation.tsx` (lines 44-55), a secondary query fetches ALL items for the selected cut plan **without any phase filter**:

```tsx
const { data: allPlanItems = [] } = useQuery({
  queryFn: async () => {
    const { data } = await supabase
      .from("cut_plan_items")
      .select(...)
      .eq("cut_plan_id", selectedBundle!.cutPlanId);
    // No .in("phase", ["clearance", "complete"]) filter!
```

Then on line 58, it **prefers** these unfiltered items over the correctly filtered bundle items:
```tsx
const checklistItems = allPlanItems.length > 0 ? allPlanItems : selectedBundle?.items ?? [];
```

The original `useCompletedBundles` hook already filters by phase correctly, but this override query undoes that filtering.

### Solution
Add the phase filter to the `allPlanItems` query so it only returns cleared items, matching the same filter used in `useCompletedBundles`.

### Changes

**File: `src/pages/LoadingStation.tsx`**
- Add `.in("phase", ["clearance", "complete"])` to the `cut_plan_items` query (around line 50)
- This ensures only cleared/completed items appear in the loading checklist, consistent with the bundle selection logic

