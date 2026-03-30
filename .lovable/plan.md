

# Add "Save Changes" Button to Apply Edits Before Download

## Problem
Currently the Download button downloads the original/last-exported video. There's no way to apply timeline edits (splits, trims, reorders, text overlays, audio) and produce an updated video before downloading.

## Solution

### `src/components/ad-director/ProVideoEditor.tsx`

**1. Add `onSaveChanges` prop and `saving` state**
- Add new prop `onSaveChanges?: () => Promise<void>` to `ProVideoEditorProps`
- Add local state `saving` boolean

**2. Add a "Save" icon button** in the top bar, between the spacer (`flex-1`) and the Download button (~line 1577-1580):
- Icon: `Save` from lucide-react (floppy disk icon)
- Label: "Save" / spinner when saving
- Green accent styling to distinguish from other buttons
- On click: calls `onExport` (which already does the full stitch+upload pipeline), then shows a success toast
- Track `hasChanges` state: set to `true` whenever `pushHistory` is called (any edit), reset to `false` after successful save
- Disable Download button when `hasChanges` is true (show tooltip "Save changes first")

**3. Track dirty state**
- Add `hasChanges` state, initialized `false`
- In `pushHistory` callback, set `hasChanges = true`
- After `onExport` completes successfully, set `hasChanges = false`
- Show a small dot/badge on the Save button when `hasChanges` is true

### `src/components/ad-director/AdDirectorContent.tsx`

No changes needed — `onExport` (which maps to `handleExport`) already does the full render pipeline (stitch clips → upload → save to history → update `finalVideoUrl`).

## UI Behavior
1. User makes edits → Save button shows indicator dot
2. User clicks Save → spinner, runs export pipeline, produces new `finalVideoUrl`
3. After save completes → Download button becomes active with updated video
4. User clicks Download → downloads the freshly rendered video

## Result
- Clear save-then-download workflow
- User knows when changes are unsaved
- Download always gets the latest rendered version

