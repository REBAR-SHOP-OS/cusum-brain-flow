

## Fix: Deliveries List Clipped by Parent Container

### Problem
The "All" tab on the `/deliveries` page shows the correct count in the tab header (matching `filteredDeliveries.length`) but not all delivery cards are visible because a parent container clips them.

### Root Cause
On line 345 of `src/pages/Deliveries.tsx`, the content wrapper uses `overflow-hidden`:

```
<div className="flex-1 overflow-hidden">
```

This parent container clips the scrollable area inside, preventing users from seeing or scrolling to all delivery cards -- even though the `TabsContent` was recently changed to `overflow-auto`.

### Solution

**File: `src/pages/Deliveries.tsx`, line 345**

Change the parent content wrapper from `overflow-hidden` to `overflow-auto`:

```
Before: <div className="flex-1 overflow-hidden">
After:  <div className="flex-1 overflow-auto">
```

This single-line change removes the clipping constraint, allowing the `ScrollArea` inside `DeliveryList` to function correctly and display all delivery cards.

### Summary

| File | Line | Change |
|---|---|---|
| `src/pages/Deliveries.tsx` | 345 | `overflow-hidden` to `overflow-auto` |

No other files, components, or database changes are affected.
