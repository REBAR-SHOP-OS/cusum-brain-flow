

# Audit: Cutter Station Jumping During Production

## Root Causes Found

### 1. No deterministic ORDER BY in the query (Critical)
`useStationData.ts` lines 103-145: The cutter query has **no `.order()` clause**. Every time realtime triggers a re-fetch, rows can return in a different order. Since `CutterStationView` tracks the current item by **index** (not by ID), the operator sees a different item after every re-fetch — this is the primary "jump."

### 2. Realtime subscription has no debounce
`useStationData.ts` lines 150-170: Every `cut_plan_items` or `cut_plans` change triggers an **immediate** `invalidateQueries`. During active cutting, `increment_completed_pieces` fires after every stroke, causing a re-fetch cascade. Combined with no ordering, this amplifies the jumping.

### 3. Index-based tracking doesn't survive re-fetches
`CutterStationView.tsx` line 47: `currentIndex` is a positional integer. When items reorder or one gets filtered out (e.g., completed item removed from query), the index stays the same but now points to a different item.

### 4. State restoration re-triggers
`CutterStationView.tsx` lines 63-90: The restoration effect depends on `items.length`, so every time items re-fetch with a different count, it can re-trigger and overwrite the operator's current position.

---

## Fix Plan

### Fix 1: Add deterministic ordering to cutter query
**File:** `src/hooks/useStationData.ts`

Add `.order("created_at", { ascending: true })` (or similar stable column) to the cutter query at line ~115 so items always return in the same order.

### Fix 2: Track current item by ID, not index
**File:** `src/components/shopfloor/CutterStationView.tsx`

After items refresh, reconcile `currentIndex` by finding the previously-viewed item's ID in the new array. Add an effect:
```typescript
const [trackedItemId, setTrackedItemId] = useState<string | null>(null);

useEffect(() => {
  if (!trackedItemId || items.length === 0) return;
  const newIdx = items.findIndex(i => i.id === trackedItemId);
  if (newIdx >= 0 && newIdx !== currentIndex) {
    setCurrentIndex(newIdx);
  }
}, [items, trackedItemId]);
```
Update `setCurrentIndex` calls to also `setTrackedItemId`.

### Fix 3: Debounce realtime invalidation (500ms)
**File:** `src/hooks/useStationData.ts`

Replace immediate `invalidateQueries` with a debounced version (matching the project's 500ms standard from memory):
```typescript
const debounceRef = useRef<ReturnType<typeof setTimeout>>();
// In subscription callback:
clearTimeout(debounceRef.current);
debounceRef.current = setTimeout(() => {
  queryClient.invalidateQueries({ queryKey: ["station-data", machineId] });
}, 500);
```

### Fix 4: Guard state restoration from re-triggering
**File:** `src/components/shopfloor/CutterStationView.tsx`

The existing `restoredFromBackend` flag already guards this, but the dependency on `items.length` can cause it to fire before the flag is set. Remove `items.length` from the dependency array — the effect already checks `items.length > 0` internally.

---

## Files Modified
- `src/hooks/useStationData.ts` — ordering + debounce
- `src/components/shopfloor/CutterStationView.tsx` — ID-based tracking + restoration guard

