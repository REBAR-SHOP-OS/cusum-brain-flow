

# Move Dwg/Item to Shape Image Area — Give Full Width to Ref

## Problem
Dwg and Item currently share a 2-column row with Ref, taking half the width. The user needs Ref to have the full card width for longer references and addresses.

## Solution
Move Dwg and Item into the shape image area (as a small overlay/caption below or beside the shape), and give the Ref row the entire card width.

### File: `src/components/office/RebarTagCard.tsx`

**1. Shape image section (lines 125-142)** — Add Dwg/Item as small text inside this area, alongside the shape image:
```
┌─────────────────────────────┐
│  (T3)   [shape image]      │
│         Dwg: CAGE  Item: 2  │
└─────────────────────────────┘
```
- Dwg and Item rendered as compact text below or to the side of the shape image
- Uses `text-xs font-black` styling, positioned at the bottom of the flex container

**2. Ref row (lines 144-157)** — Remove the 2-column grid, make Ref full-width:
```
┌─────────────────────────────┐
│ Ref: 2325                   │
│ 123 Main St, City, Province │
└─────────────────────────────┘
```
- Remove `grid grid-cols-2`, use single full-width div
- Remove the Dwg/Item column from this section
- Increase min-height for address display

### Technical detail
Single file edit. Dwg/Item move into the shape image `flex` container as a bottom-aligned row. Ref section becomes a single full-width block.

