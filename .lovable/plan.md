

# Add Audio Upload to Audio Prompt Dialog

## Problem
The Audio Prompt Dialog only supports AI-generated audio. Users need to manually upload audio/music files too. Additionally, uploaded or generated audio should properly overlay onto the video (this already works via `audioTracks` state — generated audio is added at line 302).

## Changes

### 1. `src/components/ad-director/editor/AudioPromptDialog.tsx`
- Add a third tab/mode: "upload" alongside "music" and "voiceover"
- Add file input (`<input type="file" accept="audio/*">`) for drag-and-drop or click-to-upload
- When a file is selected, create a blob URL and pass it back via a new `onUpload` callback
- Show audio preview player after file selection
- Update the `AudioPromptResult` type to include an optional `audioFile` field, or add a separate `onUpload` callback prop

### 2. `src/components/ad-director/ProVideoEditor.tsx`
- Add `onUpload` handler that receives the uploaded audio file
- Create blob URL from the file and add it to `audioTracks` (same pattern as generated audio at line 302)
- Pass the handler to `AudioPromptDialog`

## Technical Details
- Upload uses native `<input type="file" accept="audio/*">` — no backend needed
- Uploaded audio gets the same treatment as generated audio: added to `audioTracks` array with `kind: "music"` or `kind: "voiceover"`
- The existing `mergeVideoAudio` and timeline playback already handle audio tracks, so uploaded audio will automatically play over the video

## Files Changed
- `src/components/ad-director/editor/AudioPromptDialog.tsx` — add upload tab with file input and preview
- `src/components/ad-director/ProVideoEditor.tsx` — add upload handler, pass to dialog

