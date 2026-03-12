

# Fix: End Card Replaces Last Scene + Merge Audio During Stitch

## Problems Confirmed

1. **End card appended, not replacing**: The stitcher plays ALL clips then appends 4s end card. User wants the last scene (CTA) replaced by the branded end card to keep ~30s runtime.

2. **Voiceover merge still failing**: Console shows `[mergeVideoAudio] Video load failed`. The two-pass approach (stitch to blob, then reload blob into new video for audio merge) fails because MediaRecorder WebM blobs lack seekable metadata. The blob URL cannot be reliably loaded into a second `<video>` element.

3. **Logo**: Working as designed -- requires uploaded image. No change needed.

## Solution

### 1. Replace last scene with end card (`AdDirectorContent.tsx`)
When `endCardEnabled`, exclude the **last** storyboard scene from the ordered clips list before passing to `stitchClips`. The end card then fills that time slot.

```text
Before: [Scene1][Scene2]...[SceneCTA][EndCard 4s]  = ~34s
After:  [Scene1][Scene2]...[Scene6][EndCard 4s]     = ~30s
```

### 2. Merge audio INTO the stitch pass (`videoStitch.ts`)
Instead of the broken two-pass approach, accept an optional `audioUrl` in `StitchOverlayOptions`. During the canvas recording, create an `AudioContext` + `MediaElementSource` from the audio, mix its track into the `MediaRecorder`'s combined stream. This produces a single WebM with both video and audio in one pass -- no need for `mergeVideoAudio` at all.

### 3. Generate voiceover BEFORE stitching (`AdDirectorContent.tsx`)
Move the TTS fetch call to happen before `stitchClips`, then pass the audio blob URL into the stitch options. Remove the `mergeVideoAudio` call entirely.

## Files Modified
- `src/lib/videoStitch.ts` -- add `audioUrl` to overlay options, mix audio track into MediaRecorder stream
- `src/components/ad-director/AdDirectorContent.tsx` -- exclude last scene when end card enabled, generate TTS first, pass audio to stitcher
- `src/lib/videoAudioMerge.ts` -- no changes (kept as utility but no longer used in export)

