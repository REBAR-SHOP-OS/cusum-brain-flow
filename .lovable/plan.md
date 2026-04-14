

## Plan: Add Numbered Labels to Mini Connection Graph

### Problem
In the mini connection graph inside the node detail dialog, connected nodes are displayed in a circular layout without any numbering. The user wants each connected node to show a number (1, 2, 3, ...) so the order of connections is clear at a glance.

### Changes (`src/components/system-flow/MiniConnectionGraph.tsx`)

1. **Pass index number to neighbor nodes**: Add an `index` field to each neighbor node's `data` (1-based: `i + 1`)

2. **Display number badge on MiniNode**: For non-center nodes that have an `index`, render a small circular number badge (top-left corner) showing the connection order

3. **Add number labels to edges**: Use the `label` property on each edge to show the corresponding number on the connection line

### Visual Result
Each connected node will display like:
```text
 ①
┌──────────┐
│  Seomi   │
└──────────┘
```

The center node remains unchanged (no number). Numbers appear in order 1, 2, 3, etc.

### Files
| File | Change |
|---|---|
| `src/components/system-flow/MiniConnectionGraph.tsx` | Add `index` to neighbor data, render number badge on MiniNode, add edge labels |

