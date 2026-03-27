

# Move Dwg Up to Qty/Length Row, Keep Only Item in Shape Caption

## Changes (single file: `src/components/office/RebarTagCard.tsx`)

### 1. Add Dwg as third column in Qty/Length row (lines 97-108)
- Change `grid-cols-2` → `grid-cols-3`
- Add a third column showing Dwg value

```text
BEFORE:  ┌──── QTY ────┬──── LENGTH ────┐
AFTER:   ┌── QTY ──┬── LENGTH ──┬── DWG ──┐
```

### 2. Remove Dwg from shape caption (lines 152-155)
- Remove the Dwg line from the caption, keep only Item

```text
BEFORE:  Dwg: —    Item: 1
AFTER:   Item: 1
```

## File Changed
- `src/components/office/RebarTagCard.tsx`

