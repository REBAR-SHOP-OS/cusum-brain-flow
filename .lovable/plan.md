

# Camera-Style Professional Loading Animation

## Problem
The "Analyzing your idea..." loading dialog (lines 416-432 in `AdDirectorContent.tsx`) is a plain box with a spinner and progress bar. The user wants it to look like a professional camera viewfinder with cinematic animations.

## Design
A camera viewfinder UI with:
- Corner brackets (like a camera frame)
- Scanning line animation sweeping vertically
- Aperture/iris icon instead of plain spinner
- Pulsing "REC" indicator
- Cinematic progress bar with glow effect
- Film-grain subtle overlay

## Changes

### `src/components/ad-director/CameraLoader.tsx` (NEW)
Create a dedicated camera-style loading component:
- Camera viewfinder corner brackets (white/primary colored L-shapes)
- Animated horizontal scan line moving top-to-bottom
- Central aperture icon with rotation animation
- Status text with typewriter-style appearance
- "REC" dot blinking in top-right
- Progress bar styled as a cinematic bottom bar with glow
- Cancel button styled to match the dark theme
- Subtle CSS animations (scan-line sweep, aperture rotate, REC blink)

### `src/components/ad-director/AdDirectorContent.tsx` (lines 416-432)
Replace the current plain loading block with the new `<CameraLoader>` component, passing `statusText`, `progressValue`, and `onCancel`.

| File | Change |
|---|---|
| `CameraLoader.tsx` | New camera viewfinder loading component with animations |
| `AdDirectorContent.tsx` | Replace plain loader with `<CameraLoader>` |

