

# Add Odoo Priority Bar to Column Headers + Ensure Cross-Column Drag

## What's Changing

### 1. Priority Distribution Bar on Each Column Header (Odoo-exact)

Each column in Odoo shows a thin horizontal bar below the stage name that visualizes the priority breakdown of leads in that column:
- **Green** segment = high priority (3 stars)
- **Orange/Yellow** segment = medium priority (2 stars)  
- **Red** segment = low/no priority (0-1 stars)

The bar width of each color is proportional to how many leads have that priority level.

**File**: `src/components/pipeline/PipelineColumn.tsx`

- Compute priority counts from leads in each column (using existing `getPriorityStars` logic)
- Render a thin segmented bar (green | orange | red) below the stage label, before the cards
- If a column has 0 leads, show a grey placeholder bar

### 2. Cross-Column Drag-and-Drop Hardening

The board already uses native HTML5 drag-and-drop with `overflow-x-auto`. To ensure reliability:

**File**: `src/components/pipeline/PipelineBoard.tsx`

- Add `dataTransfer.setData()` in `handleDragStart` so the drag payload persists across scroll boundaries
- Add auto-scroll behavior: when dragging near the left/right edge of the board container, auto-scroll horizontally so users can reach distant columns

---

## Technical Details

### Priority Bar Calculation (PipelineColumn.tsx)

```text
For each column's leads:
  high = count where priority stars = 3
  medium = count where priority stars = 2  
  low = count where priority stars <= 1
  total = leads.length

Render bar segments as percentage widths:
  green width = (high / total) * 100%
  orange width = (medium / total) * 100%
  red width = (low / total) * 100%
```

The bar is 4px tall, rounded, placed directly under the stage name row.

### Auto-Scroll During Drag (PipelineBoard.tsx)

- On `dragOver` at the board container level, check if cursor is within 60px of left/right edge
- If so, scroll the container in that direction at a steady rate
- Clear the scroll interval on `dragEnd` or `drop`

### Files Modified

| File | Change |
|------|--------|
| `src/components/pipeline/PipelineColumn.tsx` | Add priority distribution bar below header |
| `src/components/pipeline/PipelineBoard.tsx` | Add drag data payload + auto-scroll on edges |

No database changes. No edge function changes.
