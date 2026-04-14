

## Plan: Enable Zoom in Mini Connection Graph

### Problem
The mini connection graph inside the node detail dialog has zoom disabled (`zoomOnScroll={false}`, `zoomOnPinch={false}`, `zoomOnDoubleClick={false}`), so users cannot zoom in/out to inspect connections.

### Fix (`src/components/system-flow/MiniConnectionGraph.tsx`)
- Change `zoomOnScroll` to `true`
- Change `zoomOnPinch` to `true`
- Change `zoomOnDoubleClick` to `true`
- Widen zoom range: `minZoom={0.1}`, `maxZoom={3}`

### Files
| File | Change |
|---|---|
| `src/components/system-flow/MiniConnectionGraph.tsx` | Enable all three zoom modes + widen zoom range |

### Result
- Users can zoom in/out in the mini graph using scroll, pinch, and double-click

