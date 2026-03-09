

# Plan: Hard-Filter 10M/15M from Cutter-02 Station View

## Analysis
The database `machine_capabilities` for Cutter-02 correctly only includes 20M, 25M, 30M, 35M. The `useStationData` hook already filters by these capabilities. However, the user reports seeing 10M/15M items on Cutter-02.

This could be caused by race conditions during auto-assignment (split logic) or stale data. The fix is to add an additional **client-side safety filter** in `useStationData.ts` that explicitly removes items with bar codes not in the machine's capability list.

## Changes

### `src/hooks/useStationData.ts`
- After fetching cutter items (the `return (items || [])...` block for cutter path), add a post-filter step that re-checks each item's `bar_code` is in `allowedBarCodes`
- This is a single `.filter()` call added to the existing chain — purely additive, no existing logic changed
- This ensures even if the Supabase `.in()` filter has edge cases or stale joins, the client never displays items outside the machine's capabilities

```typescript
// After the existing .filter() and .map() chain for cutter items:
.filter((item: StationItem) => allowedBarCodes.includes(item.bar_code))
```

One line addition, one file. No other changes needed.

