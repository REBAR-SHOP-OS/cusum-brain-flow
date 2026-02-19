
# Fix: ASA Shape Code Tags Visible Before "Start" is Pressed

## Root Cause — Confirmed

On the `/shopfloor/station` page bender grid overview, the `ProductionCard` component unconditionally renders the ASA shape diagram (e.g., "T2", "P1", "P2", "P3") for all bend items regardless of their production phase. The bender overview shows two categories of items:

- `phase === "cut_done"` — item has been cut but bending has NOT yet started
- `phase === "bending"` — item is actively being bent (started)

The shape diagram/tag renders for both. It should only be visible once the item's bending has been started (i.e., `phase === "bending"` or `bend_completed_pieces > 0`).

The same issue applies in the `BenderStationView` detail view: the ASA shape code badge (lines 202–207) is always rendered, even for `cut_done` items that haven't been started yet.

## What Will Be Changed

### File 1: `src/components/shopfloor/ProductionCard.tsx`

The shape diagram block (lines 156–183) currently checks:
```tsx
{isBend && item.asa_shape_code ? (
  shapeImageUrl ? ( ... ) : ( <AsaShapeDiagram ... /> )
) : ( ... )}
```

**Change:** Add a condition that the bend must be in-progress (started) before showing the shape diagram. A simple check: `item.phase === "bending"` OR `item.bend_completed_pieces > 0`. When neither is true (still `cut_done`), show the same length/MM fallback view instead:

```tsx
{isBend && item.asa_shape_code && (item.phase === "bending" || item.bend_completed_pieces > 0) ? (
  shapeImageUrl ? ( ... ) : ( <AsaShapeDiagram ... /> )
) : (
  // existing MM length fallback
)}
```

### File 2: `src/components/shopfloor/BenderStationView.tsx`

The shape code badge (lines 202–207) currently renders unconditionally:
```tsx
<div className="flex justify-start mb-4">
  <Badge ...>{currentItem.asa_shape_code || "—"}</Badge>
</div>
```

**Change:** Wrap it in a condition so the shape code badge only shows after bending has started:

```tsx
{(currentItem.phase === "bending" || (currentItem.bend_completed_pieces ?? 0) > 0) && (
  <div className="flex justify-start mb-4">
    <Badge ...>{currentItem.asa_shape_code || "—"}</Badge>
  </div>
)}
```

Similarly, the large shape diagram in the detail view (lines 209–222) should be conditionally shown. However, since the `BenderStationView` is the operator's working interface and the shape schematic is needed for reference during setup (even before the first "DONE" press), we will leave the large diagram visible — operators need it to set up the bender. Only the redundant **shape code badge** (not the diagram) will be hidden.

## Start Condition Logic

| Condition | Meaning | Show Shape Tags? |
|---|---|---|
| `phase === "cut_done"` | Cut complete, bending NOT started | No |
| `phase === "bending"` | Bending in progress | Yes |
| `bend_completed_pieces > 0` | At least one piece confirmed | Yes (fallback) |

## Scope

| File | Lines Affected | Change |
|---|---|---|
| `src/components/shopfloor/ProductionCard.tsx` | Lines 156–183 (shape diagram block) | Gate shape diagram on `phase === "bending"` or `bend_completed_pieces > 0` |
| `src/components/shopfloor/BenderStationView.tsx` | Lines 202–207 (shape code badge) | Gate badge on same condition |

Two files. Two conditional guards. No database changes, no hook changes.
