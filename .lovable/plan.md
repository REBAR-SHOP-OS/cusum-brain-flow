

# Fix Text Track (Blue Bars) — Better Delete, Drag-safe Double-Click

## Current State
- Delete button exists but is tiny (3x3px), practically invisible
- `onDoubleClick` already wired for edit — but after a drag, the browser may still fire a `dblclick` event

## Changes — `src/components/ad-director/editor/TimelineBar.tsx`

### 1. Bigger, visible delete button
Make the delete button larger (16x16) with a proper `X` icon, always visible on hover — not hidden in a 3px circle.

### 2. Prevent edit dialog after drag
Track whether a drag occurred. In `handleItemDragStart` / mouse-up logic, set a flag (`didDragRef`) when actual movement happens. In `onDoubleClick`, check the flag — if a drag just happened, skip opening the editor.

### Implementation Detail

**Delete button** (~line 894-901): Increase size from `w-3 h-3` to `w-4 h-4`, icon from `w-2 h-2` to `w-3 h-3`, add red background on hover.

**Drag-safe double-click** (~line 890-891): Add a `textDraggedRef` ref. Set it to `true` when drag movement exceeds 3px threshold. In `onDoubleClick`, if `textDraggedRef.current` is true, reset it and return early (don't open editor). Reset the ref on mouseup.

## Files Changed
- `src/components/ad-director/editor/TimelineBar.tsx`

## Result
- Delete button clearly visible on hover
- Double-click opens edit only when not dragging
- Dragging never triggers the edit dialog

