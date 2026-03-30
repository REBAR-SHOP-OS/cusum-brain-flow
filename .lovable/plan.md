
# Regenerate Entire Card (Video + Audio + Text + Music)

## Problem
The RefreshCw (🔄) icon in the toolbar currently only regenerates the **video** for the selected scene. The user wants it to regenerate **everything** for that card: video, voiceover, text overlays, and music.

## Changes

### 1. `src/components/ad-director/ProVideoEditor.tsx` — Add full scene regeneration handler
- Create `handleRegenerateFullScene(sceneId)` that:
  1. Calls `onRegenerateScene(sceneId)` to regenerate the video
  2. Removes existing voiceover audio track for that scene
  3. Removes text overlays for that scene
  4. After video regeneration completes, regenerates voiceover for that single scene (reusing TTS logic from `generateAllVoiceovers` but for one scene only)
  5. Regenerates text overlays for that scene
- Pass this new handler to `TimelineBar` as `onRegenerateScene` instead of the video-only one

### 2. `src/components/ad-director/ProVideoEditor.tsx` — Single-scene voiceover generation
- Extract single-scene voiceover logic from `generateAllVoiceovers` into a reusable function `generateVoiceoverForScene(sceneId)`
- The full regeneration handler calls this after video regen starts

### 3. `src/components/ad-director/editor/TimelineBar.tsx` — Update tooltip
- Change the tooltip from "Regenerate" to "Regenerate All (Video, Audio, Text)" to reflect new behavior

## Files Changed
- `src/components/ad-director/ProVideoEditor.tsx` — new full-scene regen handler
- `src/components/ad-director/editor/TimelineBar.tsx` — updated tooltip text
