

# Fix "MACHINE LOCKED TO ANOTHER ITEM" False Positive

## Problem
The machine's `active_job_id` (`59c94793...`) refers to an item that is no longer in the station's filtered list. This happens because `useStationData` only fetches items with `phase = queued | cutting`, but the active job may have transitioned to `cut_done` or its plan status changed. The station view then shows a scary "MACHINE LOCKED TO ANOTHER ITEM" banner with a different item underneath — confusing operators.

## Root Cause
`useStationData.ts` line 107: `.or("phase.eq.queued,phase.eq.cutting")` filters out the item the machine is actively locked to if its phase has changed.

## Fix

### `src/hooks/useStationData.ts`
Accept an optional `activeJobId` parameter. After the main cutter query, check if the active job item is in the results. If not, fetch it separately (without phase filter) and prepend it to the list. This ensures the locked item is always visible in the station view.

```text
Main query (existing) → returns queued/cutting items
                    ↓
Check: is activeJobId in results?
  YES → done
  NO  → fetch that single item by ID, prepend to list
```

### `src/components/shopfloor/CutterStationView.tsx`
Pass `machine.active_job_id` to `useStationData` so the hook can ensure the locked item is always included.

## File Changes

| File | Change |
|------|--------|
| `src/hooks/useStationData.ts` | Add `activeJobId` param; fetch and prepend missing active item |
| `src/components/shopfloor/CutterStationView.tsx` | Pass `machine.active_job_id` to `useStationData` call |

## Safety
- No database changes
- The extra fetch only fires when the active job is missing from results (rare edge case)
- Does not change filtering logic for the main queue — only ensures the locked item is always visible

