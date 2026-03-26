

# Replace Ad Director Background Video

## What
Replace the current background video (`/videos/ad-director-bg.mp4`) with the user's uploaded video (`Cameras_raining_down_202603261410.mp4`). The video is already set to `muted`, `loop`, and `autoPlay` — no code logic changes needed, just swap the file.

## Changes

### 1. Copy uploaded video to `public/videos/`
Copy `user-uploads://Cameras_raining_down_202603261410.mp4` → `public/videos/ad-director-bg.mp4` (overwriting the existing file)

### 2. No code changes needed
The existing `<video>` element at line 408-415 of `AdDirectorContent.tsx` already references `/videos/ad-director-bg.mp4` with `muted`, `loop`, and `autoPlay` — exactly what the user wants.

| Action | Detail |
|---|---|
| Copy uploaded video | Replace `public/videos/ad-director-bg.mp4` with the new file |
| Code changes | None required |

