

# Add Scene Action Buttons to Timeline Toolbar

## Problem
The toolbar area between the sidebar tab icons and the Cards/Zoom controls is empty (line 395 — just a `flex-1` spacer). The user wants quick-access scene action buttons placed there, so they don't have to right-click the scene to find Trim, Stretch, Split, etc.

## Change

### File: `src/components/ad-director/editor/TimelineBar.tsx`

Replace the empty `<div className="flex-1" />` spacer (line 395) with a row of icon buttons for the **currently selected scene**, followed by a remaining flex spacer:

**Buttons to add (icon-only, small, with tooltips):**
- Trim (-1s) — `Scissors`
- Stretch (+1s) — `Expand`
- Split — `SplitSquareHorizontal`
- Duplicate — `Copy`
- Mute/Unmute — `VolumeOff` / `Volume2`
- Regenerate — `RefreshCw`
- Delete — `Trash2` (destructive color)

**Logic:**
- Each button calls the corresponding `onXxxScene?.(selectedSceneIndex)` callback
- Buttons only render if their callback prop exists
- Regenerate only enabled if scene clip is completed
- All buttons disabled if no scene is selected (`selectedSceneIndex < 0`)
- Buttons use `variant="ghost"` with `h-6 w-6 p-0` sizing (matching zoom buttons)
- Separated from sidebar tabs with a `border-l border-border/20`

## Files Changed
- `src/components/ad-director/editor/TimelineBar.tsx` — add scene action buttons in toolbar empty space

