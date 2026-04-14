

## Plan: Add Mini Connection Graph to Node Detail Dialog

### Problem
When clicking a node, the detail dialog shows text info (bullets, layer badge, connected-to buttons) but no visual representation of the node's connections. User wants to see the node and its connected nodes as a small visual graph inside the dialog.

### Approach
Add a mini ReactFlow diagram inside the detail dialog showing:
- The selected node in the center
- All directly connected nodes around it
- The edges between them
- Each node styled with its layer accent color

### Changes

**`src/components/system-flow/MiniConnectionGraph.tsx`** (new file)
- A small ReactFlow instance (~350px tall) rendered inside the dialog
- Takes the selected node ID + all nodes/edges as props
- Filters to only show the selected node + its direct neighbors
- Positions the selected node in the center, neighbors in a radial/circular layout around it
- Uses simplified node rendering (colored rectangles with labels, no handles)
- Auto-fits the mini view on mount
- `proOptions={{ hideAttribution: true }}`, no controls/minimap, non-interactive (pan only)

**`src/pages/Architecture.tsx`**
- Import `MiniConnectionGraph`
- Pass `openNode.id`, `nodes`, and `edges` to the component
- Insert it inside the dialog between the bullets list and the "Connected to" section
- Widen dialog from `max-w-md` to `max-w-lg` to accommodate the graph

### Result
- Clicking any card shows its detail popup with a visual mini-graph of connections
- User can see at a glance which components are linked and how they relate
- The existing text details and clickable connection buttons remain unchanged

