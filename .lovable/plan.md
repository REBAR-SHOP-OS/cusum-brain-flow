

# Fix: Remove Weight Column, Restore Dwg in Shape Caption

## Problem
The previous edit incorrectly replaced "Dwg" with "Weight" in the shape caption. The user's intent was the opposite: **remove the Weight column** from the Qty/Length/Weight row, and **keep Dwg** in the shape caption.

## Changes (single file: `src/components/office/RebarTagCard.tsx`)

### 1. Remove Weight from the Qty/Length row (lines 96-112)
Change the 3-column grid to a **2-column grid** with only Qty and Length:

```text
BEFORE:  ┌─ QTY ─┬─ LENGTH ─┬─ WEIGHT ─┐
AFTER:   ┌──── QTY ────┬──── LENGTH ────┐
```

- Change `grid-cols-3` → `grid-cols-2`
- Remove the Weight `<div>` (lines 108-111)

### 2. Revert shape caption back to Dwg (line 157)
Change `Weight:` label back to `Dwg:` and swap the value from `{weight}` back to `{dwg}`:

```text
BEFORE:  Weight: 70.65    Item: 1
AFTER:   Dwg: —           Item: 1
```

