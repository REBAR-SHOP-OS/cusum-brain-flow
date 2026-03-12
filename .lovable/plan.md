

# Mirror Camera in Face ID Kiosk

## Problem
The kiosk camera feed shows the user without horizontal flip — it feels unnatural because people expect a mirror effect from front-facing cameras.

## Change
Add `style={{ transform: 'scaleX(-1)' }}` to the `<video>` element in `FaceCamera.tsx` (line 35-41). This mirrors the live preview visually while keeping the actual captured frame data unflipped (canvas capture remains correct since `captureFrame` in `useFaceRecognition` draws from the raw video stream).

Also mirror the video in `FaceEnrollment.tsx` (line 197) for consistency.

### Files
- `src/components/timeclock/FaceCamera.tsx` — add `scaleX(-1)` to video element
- `src/components/timeclock/FaceEnrollment.tsx` — add `scaleX(-1)` to video element

