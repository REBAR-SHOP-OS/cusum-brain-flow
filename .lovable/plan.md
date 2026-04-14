

## Plan: Add "Explain" Icon Button to Architecture Cards

### Problem
The architecture cards currently show only the node name, hint, and one bullet. The user wants an icon button on each card that, when clicked, opens the detail dialog showing the full description: all features/bullets, the mini connection graph, and all connections — so the user can understand what that component is made of and what it connects to.

### Approach
The detail dialog already exists and shows everything needed (bullets, mini graph, connected nodes). The card just needs a small info/explain button that triggers it directly — same as clicking the card, but more discoverable via a visible icon.

### Changes

**1. `src/components/system-flow/ArchFlowNode.tsx`**
- Add an `onExplain` callback to `ArchFlowNodeData`
- Add a small `Info` (ℹ️) icon button in the bottom-right corner of each card
- On click, call `onExplain(id)` which opens the detail dialog
- Style: semi-transparent, appears on hover or always visible with a subtle glow matching the card accent

**2. `src/pages/Architecture.tsx`**
- Pass an `onExplain` callback into each node's data that opens the detail dialog (same logic as the existing `onNodeClick`)
- Wire it through the node data when building nodes

### Result
- Each card shows a small ℹ️ icon button
- Clicking it opens the full detail dialog with all bullets, connection graph, and connected components
- Users can quickly understand what each component is made of and what it accesses

