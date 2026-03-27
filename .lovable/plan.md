

# Redesign RebarTagCard to Match Physical Printed Tag

## Problem
The current digital card layout does not match the actual physical tag printed by the Zebra printer. Key structural differences exist in header layout, body arrangement, and footer content.

## Physical Tag Layout (from photo)

```text
┌──────────────────────────────────────────────────┐
│    Mark    │  Size  │ Grade │  Qty  │   Length    │
│            │  15M   │ 400W  │  120  │   6000     │
├────────┬───┴────────┴───────┴───────┴────────────┤
│ Qty:120│                    │                     │
│ Size:15M  Shape(S)          │  Shape Image        │
│ Grd:400W  A:      G:        │  (drawing with      │
│ Len:6000  B:6000  H:        │   dimension labels) │
│ Mark:     C:      J:        │                     │
│ Bndl:     D:      K:        │                     │
│ KG:       E:      O:        │                     │
│ Item: 1   F:      R:        │                     │
├────────┬──────────┬─────────┬─────────────────────┤
│ Ref:   │ STELLAR  │ Bndl:   │ Job:                │
│ Job:   │          │ KG:     │ Dwg:                │
│ Dwg:   │  2300    │ Item: 1 │                     │
├────────┴──────────┴─────────┴─────────────────────┤
│ R.S  │  REBAR.SHOP  │  |||||||||| BARCODE ||||||  │
└──────────────────────────────────────────────────┘
```

## Changes to `src/components/office/RebarTagCard.tsx`

### 1. Top Header → 5 columns
Change from 3-column (Mark/Size/Grade) to 5-column (Mark/Size/Grade/Qty/Length). Remove the separate Qty/Length/Weight row.

### 2. Main Body → 3-column layout
Replace current stacked sections with a horizontal 3-part layout:
- **Left sidebar**: Vertical list — Qty, Size, Grd, Length, Mark, Bndl, KG, Item (compact text)
- **Center**: Shape circle at top, Dims A–F / G–R below in two columns
- **Right**: Shape image drawing (fills remaining space)

### 3. Bottom Info Row → Match physical tag
Show: Ref + address | Bndl/KG/Item | Job/Dwg — matching the physical tag's 3-column bottom section.

### 4. Footer → Add Barcode
Add R.S logo left, REBAR.SHOP center, and a Code128 barcode (mark value) on the right using an inline SVG or a lightweight barcode library. If no barcode lib is available, render the mark text in a barcode-style monospace block as a placeholder.

### 5. Props Update
Add optional `bndl` (bundle) and `job` props to the interface. These can default to empty strings.

### 6. Remove Timestamp Header
The physical tag doesn't have a timestamp row at the top — remove it to match.

## Technical Notes
- Card width stays at 4in for thermal printer compatibility
- Font sizes adjusted to fit 5-column header
- Weight moves from header to left sidebar (KG field)
- The `shapeImageUrl` rendering stays the same but moves to the right column

## Files changed
- `src/components/office/RebarTagCard.tsx` — full layout restructure to match physical tag

