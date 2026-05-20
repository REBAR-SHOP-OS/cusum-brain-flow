## Goal
Preserve the user's place in the Work Order Queue (`/shopfloor/station` → `WorkOrderQueueSection`) across re-renders, tab switches, and page reloads:
- Which customer groups are expanded/collapsed
- The window scroll position

## Implementation

### 1. Group expansion state — lifted + persisted
Currently each `StationGroup` holds local `useState(false)` so every render forgets it.

- In `WorkOrderQueueSection`: add a single `expanded: Record<string, boolean>` state, hydrated from `localStorage` key `woq:expanded:v1` on mount, written back on every change (debounced via effect).
- Pass `open` + `onOpenChange` down to `StationGroup` (controlled). Remove `StationGroup`'s internal `useState`.
- Keys = customer name (already used as group key).
- Prune stale keys on hydrate by intersecting with current group names (keeps storage small).

### 2. Scroll position — restore on mount
- In `StationDashboard.tsx` (page that mounts WOQ): add a small `useEffect` that:
  - On mount: reads `localStorage["woq:scrollY:v1"]` and `window.scrollTo(0, y)` after a microtask (so content has rendered).
  - On scroll: throttled (rAF) write of `window.scrollY` to that key.
  - On unmount: final flush.
- Scoped to this page only — does not affect other pages.

### 3. Storage helpers
Inline in the component (no new lib file needed). Wrap reads/writes in `try/catch` to ignore quota or private-mode errors.

## Files touched
- `src/components/shopfloor/WorkOrderQueueSection.tsx` — lift expansion state, persist.
- `src/pages/StationDashboard.tsx` — add scroll persistence effect.

## Out of scope
- Per-user (DB-backed) persistence — localStorage is per-device and matches "don't lose my place" intent.
- Persisting status of completed/dismissed orders.
- Animations or scroll-anchoring of newly added rows.
