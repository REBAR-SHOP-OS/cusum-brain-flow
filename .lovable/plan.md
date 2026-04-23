

## Plan — Fix two STOP buttons + stop bouncing out of the card after every stroke

### Issue 1 — Two STOP buttons appear after first stroke

**Where:** `src/components/shopfloor/SlotTracker.tsx`, lines 369-392.

**Why:** Two mutually-overlapping render conditions both become true after the first stroke:

| Button | Condition | When true |
|---|---|---|
| Big icon "STOP" (lines 370-380) | `activeSlots > 0 && !allDone` | Always during a run |
| "Stop (N pcs)" (lines 383-392) | `!allDone && totalCutsDone > 0` | After ≥1 stroke |

Both fire after stroke 1 → side-by-side duplicates (matches red-circled screenshot).

**Fix:** Keep the single "Stop (N pcs)" variant — it's more informative (shows pieces done) and is what the operator already understands. Delete the icon-only `<Button>` block (lines 369-380). Result: exactly one Stop button, always labelled with current pieces ("Stop (0 pcs)" before any stroke, "Stop (6 pcs)" mid-run).

### Issue 2 — Card view bounces back to project list after each stroke

**Where:** `src/pages/StationView.tsx`, lines 121-126.

```ts
useEffect(() => {
  if (selectedItemId && !items.some(i => i.id === selectedItemId)) {
    setSelectedItemId(null);
  }
}, [filteredItems, selectedItemId]);
```

**Why:** After every stroke, `useStationData` refetches. During the brief refetch window, `items` is `[]` → `.some()` returns false → `setSelectedItemId(null)` runs → operator is yanked out of the card back to the project list (your screenshot 2 + 3 sequence). It also fires when the item phase transitions (cutting → cut_done) and is filtered out, even though the operator is mid-run.

**Fix — three guards:**

1. **Don't bounce while data is loading or empty** — only react when `items.length > 0`. Empty list during refetch ≠ "item disappeared".
2. **Don't bounce while a run is active** — even if the item briefly moves phase, the operator is physically cutting it; keep them on the card. Pass `isRunning` (or read `machine.current_run_id === selectedItemId`) and skip the reset when active.
3. **Use `isLoading`/`isFetching` from `useStationData`** as a hard guard so the effect never runs on a transient empty array.

Final shape:
```ts
const { items, isLoading, isFetching } = useStationData(...);

useEffect(() => {
  if (isLoading || isFetching) return;            // guard 1: no transient
  if (!selectedItemId) return;
  if (items.length === 0) return;                  // guard 2: no empty refetch
  if (machine?.current_run_id === selectedItemId) return; // guard 3: active run
  if (!items.some(i => i.id === selectedItemId)) {
    setSelectedItemId(null);
  }
}, [items, isLoading, isFetching, selectedItemId, machine?.current_run_id]);
```

(Adjust to whatever fields `useStationData` actually exposes — verified at edit time; if `isFetching` isn't returned, add it to the hook's return.)

### Result

| Behavior | Before | After |
|---|---|---|
| STOP buttons during run | 2 (icon + labelled) | 1 (labelled, shows pieces) |
| After recording a stroke | bounced back to project list | stays on the cutting card |
| After mark completes (entire queue done) | auto-back after 1.5s (existing behavior) | unchanged — preserved |
| Manual back button | works | works |
| Item genuinely deleted server-side | bounces back | still bounces back (after refetch settles) |

### Out of scope

- No changes to `useSlotTracker`, `recordStroke` logic, or remnant flow.
- No changes to `auto_advance_item_phase` trigger or DB.
- No changes to `onBack` / `setSelectedItemId(null)` callsites elsewhere — only the auto-reset effect.
- No layout/styling changes beyond removing the duplicate button.

### Files touched

1. `src/components/shopfloor/SlotTracker.tsx` — delete lines 369-380 (duplicate icon STOP button).
2. `src/pages/StationView.tsx` — harden the auto-reset `useEffect` (lines 121-126) with the three guards above.
3. `src/hooks/useStationData.ts` — only if `isFetching` isn't already exposed; add it to the returned object (one-line additive change).

