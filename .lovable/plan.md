

## Plan: Single-Column Vertical Layout

### Problem
Cards are spread across many horizontal columns making it hard to scan. User wants all cards stacked vertically in one column, grouped by layer.

### Changes

**`src/lib/architectureFlow.ts`**
- Rewrite `applyArchitectureLayout`: instead of placing each layer as a separate horizontal column, stack ALL nodes vertically in a single column (same x position), grouped by layer with a gap between groups
- Rewrite `generateLayerHeaders`: place each layer header above its group of nodes at the same x position, incrementing y instead of x
- Add a `layerHeaderHeight` constant (~50px) for spacing between header and first node
- Add a `layerGroupGap` constant (~40px) for spacing between layer groups

**Layout logic:**
- All nodes share the same x = `leftMargin`
- y accumulates: for each layer → place header → place nodes vertically → add group gap → next layer
- `colSpan` in headers becomes 1 always

### Files
| File | Change |
|---|---|
| `src/lib/architectureFlow.ts` | Vertical single-column layout instead of horizontal multi-column |

### Result
- All 108 cards stack vertically in one scrollable column
- Each layer group has its header label above it
- User scrolls down to see all layers in order

