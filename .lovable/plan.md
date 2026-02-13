

# A-to-Z Audit: Shop Floor Hub and All Connected Pages

## Scope Audited (10 pages, 12 hooks, 15+ components)

Hub: `ShopFloor.tsx` | Material Pool: `PoolView.tsx` | Station Dashboard: `StationDashboard.tsx` | Station View: `StationView.tsx` | Clearance: `ClearanceStation.tsx` (already fixed) | Pickup: `PickupStation.tsx` (already fixed) | Deliveries: `Deliveries.tsx` (already fixed) | Live Monitor: `LiveMonitor.tsx` | Cutter Planning: `CutterPlanning.tsx` | TimeClock: `TimeClock.tsx`

---

## Issues Found

### A. CRITICAL: Multi-Tenant Data Leaks (5 hooks)

The following hooks query data **without a `company_id` filter**, exposing data across tenants:

| # | Hook / File | Table | Impact |
|---|-------------|-------|--------|
| A1 | `useLiveMonitorData.ts` | `machines` | All companies' machines visible |
| A2 | `useCutPlans.ts` | `cut_plans` | All companies' cut plans visible |
| A3 | `useStationData.ts` | `cut_plan_items` / `cut_plans` | Cross-tenant production items |
| A4 | `useProductionQueues.ts` | `machine_queue_items` | Cross-tenant queue items |
| A5 | `useCompletedBundles.ts` | `cut_plan_items` | Cross-tenant completed bundles |

**Fix**: Add `useCompanyId()` hook and `.eq("company_id", companyId)` filter to each query. For joins (e.g., `cut_plan_items` via `cut_plans`), use `.eq("cut_plans.company_id", companyId)` with `!inner` join.

---

### B. CRITICAL: `as any` Type Casts Bypass Safety (4 files)

| # | File | Line(s) | Cast |
|---|------|---------|------|
| B1 | `useLiveMonitorData.ts` | 20, 45, 72 | `(supabase as any)`, `(run as any)`, `profiles_safe as any` |
| B2 | `useProductionQueues.ts` | 23 | `(supabase as any)` for `machine_queue_items` |
| B3 | `ProductionCard.tsx` | 59 | `updatePayload as any` |
| B4 | `TransferMachineDialog.tsx` | 87 | `{ cut_plan_id: targetPlanId } as any` |

**Fix**: Remove `as any` casts and use proper typed objects. The `profiles_safe` view can use `.from("profiles_safe")` since it exists as a view.

---

### C. BUG: PoolView Has No `company_id` Filter and Uses `as any`

`PoolView.tsx` line 81 casts `data` items as `any` and queries `cut_plan_items` without tenant scoping. Also has a hardcoded `.limit(500)` that could truncate large datasets silently with no warning shown.

**Fix**:
- Add `company_id` filter via `cut_plans!inner` join
- Add `useCompanyId()` dependency
- Show a "showing first 500" warning when limit is hit

---

### D. BUG: StationDashboard Has No Error State

`StationDashboard.tsx` shows a loading spinner but never handles errors from `useLiveMonitorData()` or `useCutPlans()`. If either fails, users see a blank page.

**Fix**: Add error state with retry button (same pattern as Clearance/Pickup).

---

### E. BUG: PoolView Has No Error State

Same issue as D. `PoolView.tsx` uses `useQuery` which returns an `error` field, but it is never destructured or displayed.

**Fix**: Add error state display.

---

### F. BUG: StationView No Error State

`StationView.tsx` shows "Machine not found" if the machine doesn't exist but never handles query errors from `useStationData()`.

**Fix**: Display error state before the "machine not found" check.

---

### G. BUG: Hardcoded Machine IDs in `useStationData.ts`

Lines 38-42 hardcode two machine UUIDs in `CUTTER_DISTRIBUTION`. This is brittle and will break if machines are re-created or the system is deployed for another company.

**Fix**: Move distribution rules to the `machine_capabilities` table (already exists) and query them dynamically. For now, at minimum add a comment and log a warning when a machine ID is not found.

---

### H. MISSING: No `displayName` on Multiple Components

The following components lack `displayName` (violating project standards from memory):

- `VoiceRecorderWidget`
- `MyJobsCard`
- `MachineSelector`
- `LiveMachineCard`
- `ProductionCard`
- `TransferMachineDialog`
- `ForemanPanel` (and inner `PlaybookCard`)
- `StatCard` in LiveMonitor (anonymous function)

**Fix**: Add `ComponentName.displayName = "ComponentName"` to each.

---

### I. UX: Hardcoded Colors Instead of Design Tokens

| File | Issue |
|------|-------|
| `PoolView.tsx` | `bg-blue-500`, `bg-orange-500`, `text-green-500`, `text-yellow-500` |
| `StationDashboard.tsx` | `bg-green-500`, `text-green-500`, `bg-yellow-500`, `text-blue-500`, `border-green-500` |
| `ProductionCard.tsx` | `bg-orange-500`, `bg-blue-500`, `text-orange-600`, `text-blue-600` |
| `TransferMachineDialog.tsx` | `text-green-600`, `border-green-500` |

**Fix**: Replace with design tokens (`text-success`, `text-warning`, `text-primary`, `bg-success/10`, etc.) where semantic meaning matches.

---

### J. BUG: MyJobsCard Matches by `full_name` Instead of Profile ID

`MyJobsCard.tsx` line 33 queries work orders using `.eq("assigned_to", profile.full_name)`. This is fragile -- if two users share the same name, or if a name is updated, jobs will be misassigned or lost.

**Fix**: If the `work_orders.assigned_to` column is a text field (not UUID), this is a data model limitation. Add a comment documenting the risk. Ideally, migrate `assigned_to` to reference profile IDs.

---

### K. MISSING: No Back Button on StationDashboard and LiveMonitor

`StationDashboard.tsx` and `LiveMonitor.tsx` have no back navigation to the Shop Floor hub, making it hard for mobile users to return.

**Fix**: Add a back button in the header linking to `/shop-floor`.

---

### L. MISSING: `useCutPlans` Has No Realtime Subscription

Unlike other hooks, `useCutPlans.ts` uses manual `fetchPlans()` with no Supabase realtime channel. Changes made by other users or agents won't appear until refresh.

**Fix**: Add a realtime subscription on `cut_plans` table.

---

### M. MISSING: `useCompletedBundles` Has No `company_id` Filter

Already covered in A5 above but worth noting: the completed bundles shown on the Pickup Station page are unscoped.

---

## Plan (Priority Order)

### Phase 1: Security (A1-A5, B1-B4, C)
Fix all multi-tenant data leaks by adding `company_id` filters to these 6 hooks:
- `useLiveMonitorData.ts`
- `useCutPlans.ts`
- `useStationData.ts`
- `useProductionQueues.ts`
- `useCompletedBundles.ts`
- `PoolView.tsx` (inline query)

Remove all `as any` casts.

### Phase 2: Error Handling (D, E, F)
Add error states with retry buttons to:
- `StationDashboard.tsx`
- `PoolView.tsx`
- `StationView.tsx`

### Phase 3: Realtime + Navigation (K, L)
- Add realtime subscription to `useCutPlans.ts`
- Add back buttons to `StationDashboard.tsx` and `LiveMonitor.tsx`

### Phase 4: Standards (H, I)
- Add `displayName` to all components listed
- Replace hardcoded colors with design tokens where semantically appropriate

### Phase 5: Document Known Limitations (G, J)
- Add TODO comments for hardcoded machine IDs in `useStationData.ts`
- Add TODO comment for `assigned_to` name-matching in `MyJobsCard.tsx`

---

## Technical Details

### Files Modified (13 files)

| File | Changes |
|------|---------|
| `src/hooks/useLiveMonitorData.ts` | Add `company_id` filter, remove `as any` |
| `src/hooks/useCutPlans.ts` | Add `company_id` filter, add realtime subscription |
| `src/hooks/useStationData.ts` | Add `company_id` filter, document hardcoded IDs |
| `src/hooks/useProductionQueues.ts` | Add `company_id` filter, remove `as any` |
| `src/hooks/useCompletedBundles.ts` | Add `company_id` filter |
| `src/pages/PoolView.tsx` | Add `company_id` filter, error state, limit warning, design tokens |
| `src/pages/StationDashboard.tsx` | Error state, back button, design tokens, `displayName` |
| `src/pages/StationView.tsx` | Error state |
| `src/pages/LiveMonitor.tsx` | Back button, `displayName` for `StatCard` |
| `src/components/shopfloor/ProductionCard.tsx` | Remove `as any`, design tokens, `displayName` |
| `src/components/shopfloor/TransferMachineDialog.tsx` | Remove `as any`, design tokens, `displayName` |
| `src/components/shopfloor/MyJobsCard.tsx` | `displayName`, TODO comment |
| `src/components/shopfloor/VoiceRecorderWidget.tsx` | `displayName` |

### Example: `company_id` Filter Pattern (applied to each hook)

```typescript
import { useCompanyId } from "@/hooks/useCompanyId";

// Inside hook:
const { companyId } = useCompanyId();

// In query:
enabled: !!user && !!companyId,
queryFn: async () => {
  const { data, error } = await supabase
    .from("machines")
    .select("*")
    .eq("company_id", companyId)
    .order("name");
  // ...
}
```

### Example: Error State Pattern

```typescript
if (error) {
  return (
    <div className="text-center py-20 text-destructive">
      <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-60" />
      <p className="text-sm">Failed to load data</p>
      <Button variant="outline" size="sm" className="mt-3"
        onClick={() => window.location.reload()}>
        Retry
      </Button>
    </div>
  );
}
```

