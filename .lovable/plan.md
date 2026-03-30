

# Timeline: Compact Card View + Drag-to-Reorder Scenes

## Problem
The timeline currently only has one view — the full expanded track. The user wants:
1. A **compact card view** showing scenes as small cards
2. A **toggle** to switch between compact and expanded views
3. **Drag-to-reorder** scenes (not just Move Left/Right from the popover menu)

## Changes

### File: `src/components/ad-director/editor/TimelineBar.tsx`

**1. Add view mode toggle (compact / expanded)**
- Add a `viewMode` state: `"expanded" | "compact"` (default: `"expanded"`)
- Add a toggle button in the toolbar row (next to zoom controls) with `LayoutGrid` / `Rows3` icons
- When `compact`, render scenes as small horizontal cards (thumbnail + title + duration badge) in a scrollable row, ~48px tall instead of 80px
- When `expanded`, render the existing full timeline track (current behavior)

**2. Compact card view**
- Each scene rendered as a rounded card (~120px wide, ~48px tall) with:
  - Thumbnail background (from existing `thumbnails` extraction)
  - Duration badge (top-left)
  - Status dot (top-right)
  - Scene title (bottom, truncated)
  - Selected state: primary ring
- Cards sit in a horizontal flex row with gap

**3. Drag-to-reorder scenes**
- Use HTML5 drag events (`draggable`, `onDragStart`, `onDragOver`, `onDrop`) on scene cards/blocks in both views
- Track `dragIndex` and `dropIndex` state to show a visual insertion indicator
- On drop, call existing `onMoveScene` callback to reorder (compute direction from index difference)
- Show a vertical blue line at the drop target position

## Technical Details
- No new dependencies — HTML5 drag API is sufficient for scene reorder
- Both compact and expanded views support drag reorder
- Text/audio tracks only visible in expanded mode
- Time ruler only visible in expanded mode
- Zoom controls only visible in expanded mode

## Files Changed
- `src/components/ad-director/editor/TimelineBar.tsx` — add compact view toggle, drag-to-reorder

