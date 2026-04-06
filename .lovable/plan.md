
# Show Shape Diagram on All Production Cards

## Current Behavior
The center area of each `ProductionCard` (line 160-177) conditionally shows:
- **Shape diagram** only when: `isBend && asa_shape_code && (phase === "bending" || bend_completed_pieces > 0)`
- **Length number** in all other cases

This means most cards just show a big number (e.g. "7", "740", "1750") with no shape.

## Change

### File: `src/components/shopfloor/ProductionCard.tsx` (lines 159-177)

Restructure the center area to **always show the shape diagram when `asa_shape_code` exists**, regardless of bend type or phase. Show the length below or beside the shape. For items without a shape code (straight bars), keep showing the length number as-is.

New logic:
```
if (asa_shape_code exists) → show AsaShapeDiagram + length below
else → show length number only (current fallback)
```

The `AsaShapeDiagram` already handles fallback (SVG paths → circle with code) when no uploaded schematic exists, so this is safe for all shape codes.

Length will be shown as a small label beneath the shape to preserve that information on every card.
