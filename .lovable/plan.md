
# Fix: "Edit" Button on /office Causes 404

## Scope
Single file: `src/components/office/ProductionQueueView.tsx`  
One line only. No database changes. No other files touched.

## Root Cause

In `ProductionQueueView.tsx` line 197, the Edit button navigates to:
```
/cutter-planning?planId=${id}
```

However, the route registered in `App.tsx` for CutterPlanning is:
```
/shopfloor/cutter
```

There is no `/cutter-planning` route defined anywhere in the app — navigating to it produces a 404 (NotFound page).

## The Fix

Change the navigate target from the non-existent `/cutter-planning` to the correct `/shopfloor/cutter`:

```diff
- onEditPlan={(id) => navigate(`/cutter-planning?planId=${id}`)}
+ onEditPlan={(id) => navigate(`/shopfloor/cutter?planId=${id}`)}
```

The `?planId=${id}` query parameter is preserved — `CutterPlanning.tsx` already reads it via `useSearchParams` to pre-select the plan.

## No Other Changes
- No other files modified
- No database changes
- No UI layout, component structure, or styling is altered
