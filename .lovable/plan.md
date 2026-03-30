

# Change "Auto Voiceover" Button to Music-Only Generation

## Problem
The "Auto Voiceover" button (circled in screenshot) currently generates voiceovers + text overlays + music. The user wants this button to **only** generate instrumental/advertising background music and apply it to the video timeline (yellow bar in Music row).

## Changes

### `src/components/ad-director/ProVideoEditor.tsx`

**1. Rename button and create a new `generateBackgroundMusic` function:**
- New function `generateBackgroundMusic` that:
  - Clears existing music tracks only
  - Uses `lyria-music` edge function to generate instrumental ad music
  - Creates a music audio track and adds it to `audioTracks`
  - Sets `musicUrl` state
- Does NOT touch voiceover tracks, text overlays, or video

**2. Update the button (lines 1773-1782):**
- Change label from "Auto Voiceover" to "Auto Music" (or "🎵 موسیقی خودکار")
- Change `onClick` from `generateAllVoiceovers` to `generateBackgroundMusic`
- Use a separate loading state (`generatingMusic`) instead of `generatingVoiceovers`

**3. The new `generateBackgroundMusic` function logic:**
- Build a prompt from segment texts: `"Cinematic instrumental advertising background music for: ..."`
- Calculate total duration from segments
- Call `lyria-music` edge function
- On success: add music track with `kind: "music"`, `globalStartTime: 0`, `sceneId: ""`
- This ensures the yellow bar appears in the Music row of the timeline

## Files Changed
- `src/components/ad-director/ProVideoEditor.tsx` — replace button handler, add new music-only generation function

