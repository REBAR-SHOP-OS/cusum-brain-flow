

# Trim Mode for Scene Cards via Scissors Icon

## Current State
- The scissors icon currently calls `handleTrimScene` which **splits** the scene at the playhead — same as the split button.
- Resize handles already exist on each scene card (left/right edges, `w-1.5`, nearly invisible).
- `onResizeScene` and `handleResizeScene` already work to change scene duration.

## Problem
The user wants the scissors icon to enable **trimming** (adjusting start/end of the selected card), not splitting. The existing resize handles are too thin to discover.

## Plan

### 1. Add Trim Mode State — `TimelineBar.tsx`
- Add `trimMode` boolean state.
- Clicking the scissors icon toggles `trimMode` on/off (instead of calling `onTrimScene`).
- When `trimMode` is active, the scissors icon gets a highlight (e.g., `bg-red-500/30`).

### 2. Enhanced Trim Handles — `TimelineBar.tsx` (scene cards, ~line 713-769)
- When `trimMode` is true AND the scene is selected:
  - Left handle: `w-3` with visible red/yellow styling, a grip icon
  - Right handle: same
- When `trimMode` is false: keep current thin invisible handles

### 3. Update Scissors Button — `TimelineBar.tsx` (~line 515-519)
Change from:
```tsx
onClick={() => onTrimScene(selectedSceneIndex)}
```
To:
```tsx
onClick={() => setTrimMode(prev => !prev)}
```
With active state styling when `trimMode` is true.

### 4. Also Update Context Menu — `TimelineBar.tsx` (~line 785-789)
Change the "Split at playhead" context menu item for `onTrimScene` to toggle trim mode as well, or relabel it to "Trim Scene".

### 5. Auto-exit Trim Mode
- When selecting a different scene, exit trim mode.
- When clicking outside the timeline, exit trim mode.

## Files Changed
- `src/components/ad-director/editor/TimelineBar.tsx` — all changes are here (state + UI)

## Result
- Clicking scissors shows prominent drag handles on left/right of the selected scene card
- User drags handles to shorten or extend the scene
- Clicking scissors again exits trim mode
- Existing `handleResizeScene` / `onResizeScene` handles the actual duration change

