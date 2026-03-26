

# Remove Text/Subtitle Overlay from Video Output

## Problem
Despite previous emphasis, subtitle text is still being burned onto the video during the stitching process. The user wants absolutely NO text overlaid on the generated video.

## Changes

| File | Change |
|---|---|
| `src/components/ad-director/AdDirectorContent.tsx` (line 221-224) | Change `subtitles: { enabled: true, ... }` to `subtitles: { enabled: false, segments: [] }` |
| `src/lib/backgroundAdDirectorService.ts` (line 589-592) | Change `subtitles: { enabled: true, ... }` to `subtitles: { enabled: false, segments: [] }` |
| `src/components/ad-director/FinalPreview.tsx` | Remove the Subtitles toggle switch from the overlay toggles section (it should not be an option at all) |

This ensures no text is drawn on the video canvas during stitching, in both the foreground and background rendering paths.

