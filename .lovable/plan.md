

# Remove "Stretch (+1s)" Button and Functionality

## Problem
The user wants the "Stretch (+1s)" icon/button (the expand arrows icon circled in the screenshot) removed from the toolbar along with its functionality.

## Changes

### `src/components/ad-director/editor/TimelineBar.tsx`
- Remove the `Expand` icon import (if not used elsewhere)
- Remove the Stretch button block (lines 559-562):
  ```tsx
  // DELETE:
  {onStretchScene && (
    <Button ... onClick={() => onStretchScene(selectedSceneIndex)} title="Stretch (+1s)">
      <Expand className="w-3 h-3" />
    </Button>
  )}
  ```
- Remove `onStretchScene` from props interface and destructuring

### `src/components/ad-director/ProVideoEditor.tsx`
- Remove `handleStretchScene` function
- Remove passing `onStretchScene` prop to `TimelineBar`

## Files Changed
- `src/components/ad-director/editor/TimelineBar.tsx` — remove Stretch button and prop
- `src/components/ad-director/ProVideoEditor.tsx` — remove stretch handler and prop

## Result
The stretch icon disappears from the toolbar. No "+1s" functionality remains.

