

# Fix: "0 pieces" / "0%" Stuck Counter in Active Production Hub

## Problem
In `src/components/shopfloor/ActiveProductionHub.tsx`, lines 128-131, the progress display is **hardcoded to 0**:

```tsx
<span>0%</span>
<Progress value={0} className="h-1.5" />
```

No matter how many pieces are cut, the UI always shows "0%". The component receives `activePlans` (which is `CutPlan[]`) but `CutPlan` does not include `total_pieces` or `completed_pieces` -- those live in `cut_plan_items`. The component never fetches or calculates actual progress.

## Scope
**ONLY** `src/components/shopfloor/ActiveProductionHub.tsx` will be modified. Nothing else.

## Solution

### Step 1 -- Fetch aggregated progress per machine

Add a `useQuery` inside `ActiveProductionHub` that fetches `cut_plan_items` for all active plan IDs, aggregating `total_pieces` and `completed_pieces`:

```typescript
const planIds = activePlans.map(p => p.id);
const { data: itemAggregates } = useQuery({
  queryKey: ["production-hub-progress", planIds],
  enabled: planIds.length > 0,
  queryFn: async () => {
    const { data } = await supabase
      .from("cut_plan_items")
      .select("cut_plan_id, total_pieces, completed_pieces")
      .in("cut_plan_id", planIds);
    return data || [];
  },
});
```

### Step 2 -- Compute per-machine progress

Group the aggregated items by `machine_id` (via plan mapping) and compute percentage:

```typescript
// Build: machineId -> { total, completed }
const machineProgress = new Map<string, { total: number; completed: number }>();
for (const item of itemAggregates) {
  const plan = activePlans.find(p => p.id === item.cut_plan_id);
  if (!plan?.machine_id) continue;
  const entry = machineProgress.get(plan.machine_id) || { total: 0, completed: 0 };
  entry.total += item.total_pieces || 0;
  entry.completed += item.completed_pieces || 0;
  machineProgress.set(plan.machine_id, entry);
}
```

### Step 3 -- Replace hardcoded 0 with computed values

Replace:
```tsx
<span>0%</span>
<Progress value={0} className="h-1.5" />
```

With:
```tsx
const prog = machineProgress.get(machine.id);
const pct = prog && prog.total > 0 ? Math.round((prog.completed / prog.total) * 100) : 0;

<span>{pct}%</span>
<Progress value={pct} className="h-1.5" />
// Show pieces count below
<p className="text-[10px] text-muted-foreground text-right mt-0.5">
  {prog?.completed || 0} / {prog?.total || 0} pieces
</p>
```

## Files Changed
| File | Change |
|------|--------|
| `src/components/shopfloor/ActiveProductionHub.tsx` | Add useQuery for cut_plan_items aggregation, compute per-machine progress, replace hardcoded 0% |

## What Does NOT Change
- CutterStationView, BenderStationView, CutEngine, SlotTracker
- StationDashboard layout, header, Live Queue section
- Database schema, edge functions, RLS policies
- Any other page or component
