

# Custom Product Icons — Realistic SVG Icons for Rebar Products

## What
Replace generic Lucide icons (Cylinder, Square, Box, etc.) with custom inline SVG icons that visually represent each actual rebar product.

## Product → Icon Design

| Product | Current Icon | New SVG Design |
|---------|-------------|----------------|
| Fiberglass | Cylinder | A straight ribbed bar with distinct texture lines (fiberglass look) |
| Stirrups | Square | A rectangular bent loop (stirrup shape — U or closed rectangle) |
| Cages | Box | A cylindrical cage with vertical + spiral bars |
| Hooks | Anchor | A bar with a hooked/bent end (J-hook or 90° hook) |
| Dowels | ArrowDownUp | Two parallel straight bars with a gap (slab joint dowel) |
| Wire Mesh | Grid3X3 | A welded grid/mesh pattern (crossed bars) |
| Straight | Minus | A single straight ribbed rebar |

## Changes

### File: `src/components/chat/ChatInput.tsx`

1. **Create 7 inline SVG icon components** at the top of the file (or a separate file `src/components/chat/ProductIcons.tsx`):
   - Each is a small React FC returning an `<svg>` with `currentColor` stroke
   - Designed at 24×24 viewBox, styled to look like actual rebar products
   - Accept `className` prop for sizing

2. **Replace Lucide icon imports** — remove `Cylinder, Square, Box, Anchor, ArrowDownUp, Grid3X3, Minus` (if only used for products)

3. **Update PRODUCT_ICONS array** — replace `icon` references with the new custom SVG components

### New file: `src/components/chat/ProductIcons.tsx`
- 7 exported SVG icon components, each depicting the actual product shape
- Uses `stroke="currentColor"` for color compatibility with existing button styling

