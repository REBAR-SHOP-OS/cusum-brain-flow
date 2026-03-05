

# Fix: Show 20M+ Items on CUTTER-02 Station

## Problem
The station view for cutters only shows items from cut plans **assigned** to that specific machine (`cut_plans.machine_id = machineId`). When a plan contains mixed bar codes (e.g., 10M + 20M), the auto-assign logic sends the entire plan to one machine. Items outside that machine's capabilities are then invisible on both stations:
- CUTTER-01 won't show 20M items (filtered out by capabilities)
- CUTTER-02 won't show them either (plan isn't assigned to CUTTER-02)

The auto-assign logic at line 317-318 in `ShopFloorProductionQueue.tsx` routes the whole plan to CUTTER-02 if ANY item is >= 20M, but CUTTER-02's capabilities filter then removes the 10M/15M items. Those items vanish from both stations.

## Solution: Capability-based station routing (not plan-based)

Modify `useStationData.ts` cutter query to fetch items from ALL active cut plans in the company, then filter by this machine's capabilities. This replaces the current `machine_id = machineId` filter on `cut_plans`.

### Change in `src/hooks/useStationData.ts`

**Before** (lines 95-107):
```typescript
let cutterQuery = supabase
  .from("cut_plans")
  .select("...")
  .eq("company_id", companyId!)
  .eq("machine_id", machineId)  // ← Only plans assigned to this machine
  .in("status", ["draft", "queued", "running"]);
```

**After**:
```typescript
let cutterQuery = supabase
  .from("cut_plans")
  .select("...")
  .eq("company_id", companyId!)
  .in("status", ["draft", "queued", "running"])
  // Remove machine_id filter — capabilities determine routing
  .not("machine_id", "is", null);
```

The existing capability filter (lines 109-120) already removes items whose bar_code doesn't match this machine. So CUTTER-01 will only see 10M/15M items and CUTTER-02 will only see 20M-35M items, regardless of which machine the plan is assigned to.

### Files to edit
1. `src/hooks/useStationData.ts` — Remove `.eq("machine_id", machineId)` from the cutter query path

