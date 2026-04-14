

## Plan: Remove Slashed Zero from Shop Floor Counters

### Problem
The `font-mono` class on big counter numbers (strokes, pieces, bars) renders "0" with a dot/slash inside, which distracts operators on the shop floor.

### Solution
Replace `font-mono` with `font-sans` on all large counter numbers in the shop floor components. The sans-serif font renders clean zeros without interior marks while keeping the bold, heavy appearance.

### Files & Changes

| File | Change |
|---|---|
| `src/components/shopfloor/SlotTracker.tsx` | Replace `font-mono` → `font-sans tabular-nums` on lines 205, 214, 225 (bars loaded, strokes, pieces done counters) |
| `src/components/shopfloor/CutEngine.tsx` | Replace `font-mono` → `font-sans tabular-nums` on lines 359, 368 (strokes, pieces counters) |

`tabular-nums` ensures digits stay equal-width (like mono) so counters don't jump when values change, but without the slashed zero.

### Result
All shop floor counter zeros display as clean "0" without any dot or line inside — easier for workers to read at a glance.

