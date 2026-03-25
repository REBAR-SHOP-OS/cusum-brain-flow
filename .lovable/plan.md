

## Fix: Edit Button Should Navigate to Detailed List

### Problem
In the Production Queue, the "Edit" button on each manifest navigates to `/shopfloor/cutter?planId=${id}` (the cutting station). It should navigate to the **Detailed List** view instead.

### Change

**File: `src/components/office/ProductionQueueView.tsx`** (line 193)

Change the `onEditPlan` handler from:
```typescript
onEditPlan={(id) => navigate(`/shopfloor/cutter?planId=${id}`)}
```
to:
```typescript
onEditPlan={(id) => navigate("/office", { state: { section: "detailed-list", planId: id } })}
```

**File: `src/pages/OfficePortal.tsx`**

Read `planId` from `location.state` and, when the initial section is `"detailed-list"` with a `planId`, pass it down to `DetailedListView` so it auto-selects that plan.

**File: `src/components/office/DetailedListView.tsx`**

Accept an optional `initialPlanId` prop and use it to pre-select the plan on mount.

### Result
Clicking "Edit" on a manifest in the Production Queue opens the Detailed List view with that plan selected.

