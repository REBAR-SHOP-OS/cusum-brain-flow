

# Fix: Logo Overlay + End Card in Final Ad Export

## Problem
The export pipeline stitches clips and adds voiceover, but **completely ignores** the three overlay toggles (Logo, Subtitles, End Card). The "end scene" you see is whatever the AI video model generated — not a proper branded end card.

## Changes

### 1. Add logo watermark overlay during stitching (`src/lib/videoStitch.ts`)
- After drawing each video frame to canvas, if logo is enabled, draw the brand logo (semi-transparent) in the bottom-right corner
- Accept optional `logoUrl` and `logoEnabled` parameters
- Pre-load logo as an `Image` element before starting the recording loop

### 2. Add end card rendering during stitching (`src/lib/videoStitch.ts`)
- If `endCardEnabled`, after the last clip finishes, render a 3-second branded end card directly on the canvas:
  - Dark background using `brand.secondaryColor`
  - Brand name in large text using `brand.primaryColor`
  - Tagline below in white
  - Website URL at bottom with a divider line
- Record these extra 3 seconds into the final video

### 3. Add subtitle burn-in during stitching (`src/lib/videoStitch.ts`)
- Accept `subtitles` data (segment text + timing) and `subtitlesEnabled` flag
- During frame drawing, overlay current subtitle text at bottom of canvas with semi-transparent background bar
- Match subtitle to current playback position based on accumulated clip durations

### 4. Update `handleExport` in `AdDirectorContent.tsx`
- Pass `logoEnabled`, `endCardEnabled`, `subtitlesEnabled`, brand info, and segment data to the `stitchClips` function
- The overlay toggles that are currently UI-only will now actually affect the final output

### 5. Update `stitchClips` function signature
```typescript
interface StitchOptions {
  clips: { videoUrl: string; targetDuration: number }[];
  logo?: { url: string; enabled: boolean };
  endCard?: { enabled: boolean; brandName: string; tagline: string; website: string; primaryColor: string; bgColor: string };
  subtitles?: { enabled: boolean; segments: { text: string; startTime: number; endTime: number }[] };
}
```

## Files Modified
- `src/lib/videoStitch.ts` — add logo watermark, end card, and subtitle rendering during canvas capture
- `src/components/ad-director/AdDirectorContent.tsx` — pass overlay options to stitch function

