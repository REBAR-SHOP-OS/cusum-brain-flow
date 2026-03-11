

## Bug Analysis: "Initializing..." Banner Persists on Cutter Station

### Root Cause

There is a **race condition** between two effects in `CutterStationView.tsx`:

1. **Restore effect** (lines 68-96): On mount, detects an active locked job, sets `currentIndex`, and fires an async fetch to set `completedAtRunStart`.

2. **Item-change effect** (lines 151-161): Watches `currentItem.id` changes. When the restore effect sets `currentIndex` (changing `currentItem`), this effect fires and **resets `completedAtRunStart` to null** — potentially AFTER the async fetch resolves and sets it.

Timeline:
```text
1. Restore effect fires → setCurrentIndex(lockedIndex)
2. React re-renders → currentItem changes
3. Item-change effect fires → setPrevItemId(currentItem.id)
   (prevItemId was null on first render, so the reset guard passes through)
4. Async fetch resolves → setCompletedAtRunStart(value) ← MAY happen before or after #3
5. If #3 fires AFTER #4 → completedAtRunStart is reset to null → stuck forever
```

Additionally, the restore fetch has **no `.catch()` handler**, so a network error silently leaves `completedAtRunStart` as null.

### Fix Plan

**File: `src/components/shopfloor/CutterStationView.tsx`**

1. **Fix the item-change effect to skip reset during restoration**: Add a guard so the `prevItemId` effect does NOT reset `completedAtRunStart` when `restoredFromBackend` is false (i.e., during the initial restore sequence). This prevents the race.

2. **Add `.catch()` to the restore fetch** (line 84-91): On error, fall back to `setCompletedAtRunStart(0)` so the station never gets permanently stuck.

3. **Reset `completedAtRunStart` in the catch block of `handleLockAndStart`** (line 356-358): When start fails, also clear `completedAtRunStart` to prevent stale state.

### Technical Changes

```text
Line 84-91: Add .catch() → setCompletedAtRunStart(currentItem.completed_pieces ?? 0)
Line 152-161: Add guard: skip reset if !restoredFromBackend  
Line 356-358: Add setCompletedAtRunStart(null) in the catch block
```

These are minimal, surgical changes that don't alter any other behavior.

