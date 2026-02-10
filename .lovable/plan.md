
# Fix: Clicking a specific item opens the wrong item in Cutter Station

## Problem

When you click on a production card (e.g., the 5100mm item "AS05"), the Cutter Station always opens at the **first item** (e.g., AS02 with 10650mm) instead of the one you clicked on. This is because `StationView.tsx` does not pass the selected item's index to `CutterStationView`.

The Bender view already handles this correctly (line 56 passes `initialIndex`), but the Cutter view on line 61 does not.

## Solution

Two surgical changes:

### 1. `src/pages/StationView.tsx` (line 60-62)
Pass the correct `initialIndex` to `CutterStationView`, matching what the bender already does:

```typescript
if (machine.type === "cutter") {
  const itemIndex = items.findIndex((i) => i.id === selectedItemId);
  return (
    <CutterStationView
      machine={machine}
      items={items}
      canWrite={canWrite}
      initialIndex={itemIndex >= 0 ? itemIndex : 0}
    />
  );
}
```

### 2. `src/components/shopfloor/CutterStationView.tsx`
- Add `initialIndex` to the props interface (optional, defaults to 0)
- Use it as the initial value for `useState(initialIndex ?? 0)` instead of `useState(0)`

No other files or logic are affected.
