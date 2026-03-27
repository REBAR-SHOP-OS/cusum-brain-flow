

# Sync RebarTagCard with PrintTag Layout

## Problem

The office page card (`RebarTagCard.tsx`) and the print preview (`PrintTag` in `PrintTags.tsx`) render completely different layouts for the same data:

| Section | RebarTagCard (office) | PrintTag (print preview) |
|---------|----------------------|--------------------------|
| Qty/Length/Weight | 2-col (Qty+Length) then separate Weight row | 3-col row (Qty, Length, Weight) |
| Dims | Only active dims, chunked in 4s, flat text | All 12 dims in 2-column grid (A-F left, G-R right) with shape circle |
| Shape | Not shown | Shape code circle + "SHAPE" label + shape image area |
| Barcode | Fake text barcode | Not present |
| Footer | Duplicate timestamp header/footer | "R.S" left + "REBAR.SHOP" right |

## Fix

Rewrite `RebarTagCard.tsx` to match the `PrintTag` structure exactly:

1. **Timestamp header**: Keep, but match PrintTag order (date left, "REBAR SHOP OS" right)
2. **Mark/Size/Grade**: Already matches — keep as-is
3. **Qty/Length/Weight**: Change from 2-col + separate weight row → single 3-col row
4. **Shape + Dims**: Replace flat "DIMS:" section with 2-column layout: shape circle on left, all 12 dims (A-F / G-R) in 2-column grid on right — show empty dims too
5. **Shape image**: Add flexible area showing `shapeImageUrl` or shape code placeholder
6. **Remove barcode**: Delete the fake barcode section
7. **Ref/Dwg/Item**: Change to 2-column grid (Ref+address left, Dwg+Item right)
8. **Footer**: Change to "R.S" left + "REBAR.SHOP" right

### Technical detail

All changes in one file: `src/components/office/RebarTagCard.tsx`. The component will be rewritten to mirror the inline styles and structure of the `PrintTag` component in `PrintTags.tsx`, but using Tailwind classes for consistency with the rest of the codebase.

The `DIM_LEFT` / `DIM_RIGHT` split replaces the current `activeDims` chunking logic.

