

## Plan: Fix Zoom Reset on Hover/Interaction

### Problem
The `useEffect` on line 443 of `Architecture.tsx` calls `reactFlowInstance.fitView()` every time `visibleNodeCount` or `visibleEdgeCount` changes. Since hovering a node shows/hides edges (changing `visibleEdgeCount`), and toggling layers changes `visibleNodeCount`, the view constantly resets — overriding any manual zoom the user applied.

### Root Cause
The dependency array `[reactFlowInstance, visibleNodeCount, visibleEdgeCount]` is too broad. Edge visibility changes from hover should not trigger a re-fit.

### Fix (`src/pages/Architecture.tsx`)
1. Remove `visibleEdgeCount` from the `useEffect` dependency array — edge visibility changes from hover/lock should never reset zoom
2. Replace the `visibleNodeCount` dependency with a stable key based on `visibleLayers` set — only re-fit when the user explicitly toggles a layer on/off or performs a search, not when node data updates
3. Add a `fitView` call only on initial load (when `reactFlowInstance` first becomes available) using a ref flag to prevent repeat calls

Concrete change:
- Use a `useRef(false)` to track whether initial fit has happened
- The `useEffect` fires `fitView` only when `reactFlowInstance` is first set, or when `visibleLayers` or `searchQ` changes (explicit user actions)
- Remove `visibleEdgeCount` entirely from the dependency

### Files
| File | Change |
|---|---|
| `src/pages/Architecture.tsx` | Fix `useEffect` dependencies to prevent zoom reset on hover/interaction |

### Result
- User can zoom in/out freely without the view snapping back
- `fitView` only runs on initial load and when layers/search change (intentional actions)
- Hover-to-reveal edges no longer resets zoom

