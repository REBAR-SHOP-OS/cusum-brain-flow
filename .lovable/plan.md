

# Fix: Architecture Diagram Half Hidden — Nodes Clipped

## Root Cause

The **Data + Platform** layer has 16 nodes. At 130px width + 30px gap each, that's ~2,720px wide. But `CENTER_REF = 1200` tries to center them around a 1,200px reference — pushing nodes far off the left edge (negative x coordinates). Combined with `fitView` padding of only 0.1, the initial viewport clips many nodes.

Other layers (Entry: 5, Auth: 4, Modules: 8, AI: 9, Integrations: 9, External: 7) also exceed 1,200px in some cases.

## Fix

### File: `src/pages/Architecture.tsx`

**1. Increase `CENTER_REF` to match widest layer**

Change `CENTER_REF` from `1200` to `2800` so all 16 platform nodes fit without negative x positions.

**2. Increase `fitView` padding**

Change `padding: 0.1` to `padding: 0.15` so the initial zoom level shows all content with breathing room.

**3. Set `LEFT_MARGIN` to `40`**

Reduce from `160` to `40` — the sidebar already provides separation; we don't need 160px of empty space inside the canvas.

**4. Split platform layer into 2 sub-rows**

To avoid one impossibly wide row of 16 nodes, split Data + Platform into two visual rows of 8 nodes each. This is done in `buildInitialNodes` by detecting when a layer has >10 nodes and wrapping to a second row with half `LAYER_GAP` offset.

### Result

- All nodes visible on initial load
- `fitView` auto-zooms to show the full diagram
- Platform layer wraps cleanly into two rows
- No other files changed

## Impact
- Only layout positioning changes in Architecture.tsx
- No data, edge, or interaction changes
- All editing features preserved

