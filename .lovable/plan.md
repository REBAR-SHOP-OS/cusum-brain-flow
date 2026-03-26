

# Add User Audio Upload to Timeline

## What
The "Add audio" button in the timeline currently only triggers auto-voiceover generation. The user wants to upload audio files (music/sound) from their computer and have them applied to the video as audio tracks.

## Changes

### 1. `src/components/ad-director/ProVideoEditor.tsx`
- Add a hidden `<input type="file" accept="audio/*">` ref
- Create `handleUploadAudio` function that:
  - Opens file picker
  - Creates a blob URL from the selected file
  - Adds a new `AudioTrackItem` with `kind: "music"`, the blob URL, and file name as label
  - Appends to `audioTracks` state
- Change `onAddAudio` prop from `generateAllVoiceovers` to `handleUploadAudio`

### 2. `src/components/ad-director/editor/TimelineBar.tsx`
- Update the "Add audio" button label to "Add audio" (keep as is) with an `Upload` icon instead of just `Music`
- No structural changes needed — uploaded tracks will render in the existing audio track UI with volume controls and remove button

## Flow
1. User clicks "Add audio" in timeline
2. File picker opens (accepts audio/*)
3. User selects MP3/WAV/etc
4. Audio track appears in timeline with volume slider and remove button
5. Audio plays alongside video during playback

| File | Change |
|---|---|
| `ProVideoEditor.tsx` | Add file input ref, upload handler, wire to `onAddAudio` |
| `TimelineBar.tsx` | Update button icon to Upload |

