

## Plan: Fix Fit-View Button for Full Architecture View

### Problem
The fit-view button (circled in the screenshot) doesn't properly fit all 108 nodes into the viewport. The diagram is very large (8 layers, up to 29 nodes per layer) and the default ReactFlow `fitView` may not be zooming out enough.

### Root Cause
ReactFlow's `Controls` component has a built-in fit-view button, but two issues may prevent proper fitting:
1. `minZoom` is not explicitly set — ReactFlow defaults to `0.5`, which may not be enough zoom-out for 108 nodes spread across the canvas
2. The `fitViewOptions` padding may be too generous, preventing tight fitting

### Changes

**`src/pages/Architecture.tsx`**:
1. Add `minZoom={0.05}` to the `<ReactFlow>` component — allows zooming out far enough to see all nodes
2. Update `fitViewOptions` padding from `0.15` to `0.05` for tighter fit
3. Update the programmatic `fitView` call padding from `0.18` to `0.08`

This is a 3-line change in a single file. The built-in Controls fit-view button will then zoom out sufficiently to show the entire architecture.

