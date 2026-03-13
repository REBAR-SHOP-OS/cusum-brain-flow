

# Image Edit: Preview Before Apply

## Problem
Currently, when the user clicks "Apply", the edited image is immediately sent to the parent via `onImageReady` and the dialog closes. The user has no chance to see the result and accept/reject it.

## Solution

### `src/components/social/ImageEditDialog.tsx`

1. **Add `previewUrl` state** — stores the base64/URL of the AI-edited image returned from the edge function.
2. **Change `handleApply` flow**:
   - Call the edge function as before (already uses Nano Banana / Gemini image model via `generate-image`).
   - Instead of calling `onImageReady` immediately, set `previewUrl` with the result.
3. **Add preview UI**:
   - When `previewUrl` is set, show the edited image preview with two buttons: **"Confirm"** (✓) and **"Retry"** (↻).
   - **Confirm**: calls `onImageReady(previewUrl)`, closes dialog.
   - **Retry**: clears `previewUrl`, returns to the canvas/prompt editing state so user can try again.
4. **Hide canvas and controls** when preview is showing — show only the preview image and confirm/retry buttons.

### Model
The edge function already uses `google/gemini-3-pro-image-preview` for edit mode — no backend changes needed. Optionally switch to `google/gemini-3.1-flash-image-preview` (Nano Banana 2) for faster edits.

### Files
- `src/components/social/ImageEditDialog.tsx` — add preview state and confirm/retry UI

