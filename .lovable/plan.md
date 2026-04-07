

# Fix: Tame the Spaghetti — Interactive Edge Visibility

## Problem
77 nodes + 107 edges all visible at once = unreadable chaos. Every edge draws a curve across multiple layers, creating a tangled mess that defeats the "ADHD-proof" goal.

## Solution: Edges On Demand

**Hide all edges by default. Show only the edges connected to the hovered/selected node.** This is the single highest-impact change possible — zero spaghetti, instant clarity.

### Behavior
1. **Default state**: All nodes visible, NO edges drawn. Clean layered grid.
2. **Hover a node**: All edges connected to that node fade in with glow. Connected nodes get highlighted, others dim.
3. **Click a node**: Locks the edge view (persists after mouse leaves). Click again or click background to clear.
4. **"Show all" toggle**: Existing toggle in sidebar still works for those who want full spaghetti view.

### Additionally: Prune Redundant Edges
Cut ~20 low-value edges that add visual noise without architectural clarity:
- Remove 12 `role-guard → module` edges → replace with a single visual indicator (all modules are behind auth, it's implied by the layer structure)
- Remove duplicate `persist` edges (3 modules all connecting to primary-db separately → keep only 1 representative edge + a "all modules persist" note)

This brings edge count from 107 → ~75, and only ~5-10 visible at any time during interaction.

## Technical Changes

### File: `src/pages/Architecture.tsx`
1. Add `hoveredNode` and `lockedNode` state
2. Filter edges: only render edges where `source === activeNode || target === activeNode`
3. When a node is active, dim non-connected nodes (opacity 0.25)
4. Add `onNodeMouseEnter` / `onNodeMouseLeave` / `onNodeClick` handlers
5. Add a small "Show all edges" checkbox in the toolbar

### File: `src/lib/architectureGraphData.ts`
1. Remove 12 `role-guard → *` edges (e10-e19c) — replace with a layer-level annotation
2. Remove 3 duplicate `persist` edges (keep e60, remove e61, e62)
3. Total edges: 107 → ~92

### File: `src/components/system-flow/ArchFlowNode.tsx`
1. Accept `dimmed` prop → apply opacity 0.25 + no pointer events when dimmed
2. Accept `highlighted` prop → add brighter border glow when highlighted

## Result
- Default view: clean grid of colored nodes, zero crossing lines
- Hover any node: see exactly what it connects to
- Executive-friendly at rest, engineer-friendly on interaction
- Same data, same nodes, dramatically better comprehension

