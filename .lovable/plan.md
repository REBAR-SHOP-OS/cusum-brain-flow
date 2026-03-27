

# Fix RebarTagCard: 3 Layout Adjustments

## Changes requested (from annotated screenshot)

1. **#1 — Replace shape circle with brand logo**: Replace the shape code circle + "SHAPE" label with the `logo-coin.png` brand logo image
2. **#2 — Move G-R dims up, parallel with A-F**: Currently G-R dims render below A-F in the same column area. Fix the grid so A-F and G-R render side-by-side as two parallel columns
3. **#3 — Move Dwg/Item up, give more space to Ref**: The Ref/Dwg/Item row needs Dwg+Item moved up (less padding) and Ref gets more vertical space for address display

## File: `src/components/office/RebarTagCard.tsx`

### Change 1: Replace shape circle with brand logo
- Import `logoCoin from "@/assets/logo-coin.png"`
- Replace the circle div (lines 103-108) with an `<img>` of the logo coin, sized ~40px

### Change 2: Fix dims grid alignment
- The dims grid (lines 110-123) already uses `gridColumn: 1` and `gridColumn: 2`, but all items render sequentially. The issue is the grid has `grid-cols-2` but items are placed by `gridColumn` style — need to use CSS grid row placement so A-F occupy rows 1-6 col 1, and G-R occupy rows 1-6 col 2.
- Change to explicit `gridRow` assignments so both columns render in parallel.

### Change 3: Ref section gets more space, Dwg/Item compact
- Increase Ref section padding/min-height
- Make Dwg/Item section more compact (reduce py)

### Technical detail

Single file edit. The grid fix for dims uses `gridRow: i+1` on each dim item so the two columns align row-by-row.

