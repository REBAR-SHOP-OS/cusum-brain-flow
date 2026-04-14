

## Plan: Add Layer Headers + Fix Empty "Business Modules" Layer

### Problem
1. No visible column headers — user can't tell which layer each column represents
2. "Business Modules" layer shows 0 cards because all nodes were moved to "items" in the previous update
3. Some nodes may appear misaligned without clear column boundaries

### Changes

**1. Remove empty "Business Modules" layer (`src/lib/architectureGraphData.ts`)**
- Remove `{ key: "modules", ... }` from `LAYERS` array since it has 0 nodes — all business module nodes are already in `"items"` layer
- Remove `"modules"` from the `ArchLayer` type union
- Re-number `y` values for remaining layers

**2. Add layer header nodes (`src/lib/architectureFlow.ts`)**
- Export a new function `generateLayerHeaders()` that creates label-only nodes positioned above each column
- Each header shows the layer name (e.g., "External Services", "System Items", "AI / Automation")
- Headers are positioned at `y = 0` (above first node row), spanning the width of sub-columns if a layer wraps

**3. Render header nodes in ReactFlow (`src/pages/Architecture.tsx`)**
- Register a new `layerHeader` node type — a simple styled div with the layer name and accent color
- Create a `LayerHeaderNode` component: non-draggable, non-connectable, styled as a centered label with accent-colored text/border
- Merge header nodes into the ReactFlow nodes array alongside arch nodes
- Headers should be non-interactive (no click/hover effects, no handles)

**4. Create LayerHeaderNode component (`src/components/system-flow/LayerHeaderNode.tsx`)**
- Simple React component: displays layer label with accent color styling
- No handles, not draggable, not selectable
- Styled to span the column width with subtle background

### Files
| File | Change |
|---|---|
| `src/lib/architectureGraphData.ts` | Remove empty `modules` layer from LAYERS + ArchLayer type |
| `src/lib/architectureFlow.ts` | Add `generateLayerHeaders()` function that computes header positions |
| `src/components/system-flow/LayerHeaderNode.tsx` | New — simple header node component |
| `src/pages/Architecture.tsx` | Register `layerHeader` node type, merge headers into nodes |

### Result
- Each column has a visible layer title above it (e.g., "External Services", "AI / Automation", "Data + Platform")
- No empty "Business Modules" layer cluttering the sidebar
- All 108 nodes properly grouped under their labeled columns

