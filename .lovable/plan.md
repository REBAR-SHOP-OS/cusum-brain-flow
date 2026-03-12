

# Fix: Logo Missing + Voiceover Merge Failing + End Card Issues

## Root Causes Found

1. **No logo**: `DEFAULT_BRAND.logoUrl` is `null`. The condition `logoEnabled && !!brand.logoUrl` evaluates to `false`, so logo overlay is skipped. The user needs to upload a logo in the brand settings, OR we should let users upload one in the ScriptInput panel.

2. **Voiceover merge fails**: Console shows `"Failed to load video for merge"`. The `mergeVideoAudio` function tries to load the blob URL from `stitchClips` into a new `<video>` element, but MediaRecorder-produced WebM blobs often fail to reload in another video element because they lack proper seeking metadata. The fix: set `video.muted = true` before setting `.src` (some browsers block unmuted media element loads), and add a fallback so the stitched video is still used even without audio.

3. **End card "lol" scene**: The end card IS being rendered by the stitcher, but it looks like the AI-generated last scene is what appears instead. This is because the last storyboard scene is an AI-generated "CTA" scene that looks bad. The end card renders AFTER all clips -- so it should appear at the very end. The user may be seeing the last generated clip, not the end card itself.

## Changes

### 1. Fix `mergeVideoAudio` to handle blob URLs (`src/lib/videoAudioMerge.ts`)
- Set `video.muted = true` before setting src (required for autoplay/load in some browsers)
- Add timeout fallback: if video fails to load within 5 seconds, resolve with the original videoSrc (silent but functional)

### 2. Fix logo availability (`src/components/ad-director/ScriptInput.tsx`)
- The logo upload UI likely exists but `logoUrl` stays null after upload. Need to verify the upload actually sets `brand.logoUrl` to a usable URL (blob or data URL).

### 3. Improve end card visibility (`src/lib/videoStitch.ts`)
- Extend end card duration from 3s to 4s for better visibility
- Add a fade-in transition effect (gradual opacity increase over first 0.5s)

## Files to Modify
- `src/lib/videoAudioMerge.ts` -- fix blob URL loading
- `src/components/ad-director/ScriptInput.tsx` -- verify logo upload sets brand.logoUrl
- `src/lib/videoStitch.ts` -- minor end card duration tweak

