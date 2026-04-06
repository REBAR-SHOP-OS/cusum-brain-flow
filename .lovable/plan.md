

# Fix: External Services Layer Edges Not Visually Connected

## Problem
The Backend → External Services edges are technically present in the data (e50-e58) but appear nearly invisible on screen. This is caused by:
1. **Low base opacity** (0.55) combined with gradient stop opacity (0.5) = effective ~0.275 opacity
2. **Blue gradient** on dark background has poor contrast
3. Edges blend into the dark canvas making External Services look "unwired"

## Solution

### File: `src/pages/Architecture.tsx`

1. **Increase edge base opacity** from 0.55 to 0.7 for non-highlighted edges (line ~352)
2. **Increase gradient stop opacity** — raise the start/end from 0.5 to 0.7, and mid from 0.9 to 1.0 (lines ~324-326)
3. **Increase edge stroke width** from 1.5 to 2 for non-highlighted state (line ~349)

These three changes make ALL edges more visible, especially the backend→external ones.

### File: `src/lib/architectureGraphData.ts`

No changes needed — all 9 backend→external edges (e50-e58) already exist and are correct.

## Impact
- All edges become more visible, especially the lower layers
- No layout, data, or interaction changes
- Only visual enhancement to edge rendering

