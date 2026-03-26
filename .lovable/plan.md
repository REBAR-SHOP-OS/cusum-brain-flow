

# Enable Intro Video Sound

## Problem
The intro video (`/videos/ad-director-intro.mp4`) currently has the `muted` attribute, so it plays silently.

## Change

### `src/components/ad-director/AdDirectorContent.tsx` — Line 385

Remove the `muted` attribute from the intro video element so the video plays with its original audio.

| File | Change |
|---|---|
| `AdDirectorContent.tsx` | Remove `muted` from intro video (line 385) |

