
# Fix: Loading Station Shows Only 1 Item Instead of All 5

## Root Cause — Confirmed

**File:** `src/hooks/useCompletedBundles.ts`, **line 37**

```ts
.eq("phase", "complete")
```

The `useCompletedBundles` query **only fetches items where `phase = 'complete'`**. However, items must pass through a `"clearance"` phase (QC verification) before being promoted to `"complete"` — and this promotion happens **one item at a time** as each is individually cleared by a QC operator in the Clearance screen.

**Database evidence (live data):**
The bundle "EARNSCLIFFE CRICKET AIR DOME" has 5 items. The user sees only 1 on the Loading Station because only 1 has been individually cleared through QC (`phase = 'complete'`). The other 4 are still sitting at `phase = 'clearance'` — they are physically done being manufactured, but their QC paperwork hasn't been ticked off one by one yet.

**The correct Loading Station behaviour** should show all items that are *ready for the truck* — meaning **both** `phase = 'clearance'` AND `phase = 'complete'` items should appear in a bundle, because both mean the item is physically ready (it left the bender/cutter and has been staged).

## The Fix — One File Only: `src/hooks/useCompletedBundles.ts`

Change the single `.eq("phase", "complete")` filter to `.in("phase", ["clearance", "complete"])` so the bundle includes all items that have cleared production (either awaiting final QC sign-off or fully cleared).

### Before (broken — excludes clearance-phase items):
```ts
.eq("phase", "complete")
```

### After (fixed — includes both clearance and complete items):
```ts
.in("phase", ["clearance", "complete"])
```

This is a one-line change. The grouping logic, the `CompletedBundle` interface, the `LoadingStation.tsx` rendering loop, and the checklist system all remain entirely untouched — they already handle however many items are in `bundle.items`.

## Scope

| File | Line | Change |
|---|---|---|
| `src/hooks/useCompletedBundles.ts` | 37 | `.eq("phase", "complete")` → `.in("phase", ["clearance", "complete"])` |

## What Is NOT Changed
- `src/pages/LoadingStation.tsx` — untouched
- `src/hooks/useLoadingChecklist.ts` — untouched
- `src/components/dispatch/ReadyBundleList.tsx` — untouched
- `src/components/clearance/ClearanceCard.tsx` — untouched
- All other pages, components, database logic — untouched
