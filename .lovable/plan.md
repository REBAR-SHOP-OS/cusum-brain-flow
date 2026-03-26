

# Enable Subtitle Text Editing via Proper Dialog

## Problem
The "Edit Text" button on subtitle overlays currently uses `window.prompt()` — a raw browser dialog. The user wants a proper editing experience for the main subtitle text displayed on the video.

## Current Flow
1. Subtitles are auto-generated from `segment.text` (voiceover) → split into chunks → rendered as timed `VideoOverlay` items
2. Clicking "Edit Text" on a text overlay in the timeline triggers `prompt("Edit overlay text:", ov.content)` and updates the overlay
3. This works but is not user-friendly

## Solution
Replace the `prompt()` call with a proper inline edit dialog that allows editing the subtitle text with a text input, preview of the current text, and save/cancel buttons.

### Changes

#### 1. Create `EditOverlayDialog.tsx`
New dialog component at `src/components/ad-director/editor/EditOverlayDialog.tsx`:
- Props: `open`, `overlay` (VideoOverlay | null), `onSave(id, newContent)`, `onClose`
- Shows overlay's current `content` in an `Input` field
- Save button updates the overlay, Cancel closes
- Enter key submits

#### 2. Update `ProVideoEditor.tsx`
- Import and render `EditOverlayDialog`
- Add state: `editingOverlay: VideoOverlay | null`
- Replace `prompt()` in `onEditOverlay` callback (line 1403-1406) with: `setEditingOverlay(ov)`
- On dialog save: update the overlay content in `setOverlays`

| File | Change |
|---|---|
| `src/components/ad-director/editor/EditOverlayDialog.tsx` | New — edit dialog with Input, save/cancel |
| `src/components/ad-director/ProVideoEditor.tsx` | Replace `prompt()` with dialog state + render `EditOverlayDialog` |

