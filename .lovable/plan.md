

# Remove Download and Schedule Buttons from Result View

## Problem
The user wants to remove the "Download" and "Schedule" buttons from the result/storyboard view (circled in red in the screenshot). Only "Edit Video" should remain.

## Change

### `src/components/ad-director/AdDirectorContent.tsx` (lines 535-538, 543-582)

Remove:
1. The `Download` button (lines 535-538)
2. The `Schedule` Popover and its entire content (lines 543 to end of popover)

Keep only the "Edit Video" button in the approved state.

| File | Change |
|---|---|
| `AdDirectorContent.tsx` | Remove Download button and Schedule popover from result view |

