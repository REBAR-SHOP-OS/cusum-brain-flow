

## Plan: Open relationship detail panel on single click

### Current behavior
- **Single click**: Toggles edge-highlight lock on the node (lines 328-331)
- **Double click**: Opens a detail dialog showing the node info + "Connected to" list (lines 333-342)

### Problem
Users expect clicking a node to show its relationships, but that only happens on double-click. Single click just locks edge highlighting with no visible feedback panel.

### Changes

**`src/pages/Architecture.tsx`** — `onNodeClick` callback (line 328-331)

Merge the lock toggle and dialog open into the single-click handler:
- Keep the lock toggle (`setLockedNode`)
- Also open the detail dialog (`setOpenNode`) with the clicked node's data — same logic currently in `onNodeDoubleClick`
- Remove or keep `onNodeDoubleClick` as a no-op (since single click now handles it)

This is a ~5-line change in one file. The detail dialog already renders the full relationship view with clickable connected-node buttons.

