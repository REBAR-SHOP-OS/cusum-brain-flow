

# Auto-Expand Only Active Customer Sections in StationView

## Problem
All customer `Collapsible` sections default to `defaultOpen={false}` (collapsed). The user wants sections containing actively in-progress items to auto-expand while idle sections stay collapsed.

## Current Code (lines 419, 443)
- Customer Collapsible: `defaultOpen={false}` — always collapsed
- Barlist Collapsible: `defaultOpen={false}` — always collapsed

## Fix

### File: `src/pages/StationView.tsx`

**1. Add `hasActiveWork` flag to customerGroupedData** (inside the useMemo at ~line 169)

For each customer entry, compute whether any item has `phase === "cutting"` or `phase === "bending"` (indicating active production). Store this as a boolean `hasActiveWork` on each customer object.

**2. Add `hasActiveWork` flag per barlist** (same useMemo)

For each barlist entry, check if any of its items have an active phase. Store as `hasActiveWork`.

**3. Update Collapsible `defaultOpen` props**

- Line 419 (customer): `defaultOpen={cust.hasActiveWork}`
- Line 443 (barlist): `defaultOpen={bl.hasActiveWork}`

## Exact Changes

In the `useMemo` return block (~line 169), add to each barlist object:
```typescript
hasActiveWork: bl.items.some(i => i.phase === "cutting" || i.phase === "bending"),
```

And to each customer object (~line 197):
```typescript
hasActiveWork: [...cust.barlists.values()].some(bl =>
  bl.items.some(i => i.phase === "cutting" || i.phase === "bending")
),
```

Then update:
- Line 419: `defaultOpen={cust.hasActiveWork}`
- Line 443: `defaultOpen={bl.hasActiveWork}`

## Scope
- 1 file, 4 touch points
- No runtime behavior change beyond collapse defaults
- Consistent with existing shop-floor-ui-defaults memory

