

# Fix Blurry Timeline Video Strip

## Problem
The timeline strip shows a single low-resolution thumbnail (160×90, JPEG quality 0.6) which appears blurry when stretched across the full timeline width.

## Solution
Improve the `useVideoThumbnails` hook in `TimelineBar.tsx`:

1. **Increase resolution**: Change canvas size from 160×90 to 480×270 (3x larger)
2. **Increase quality**: Change JPEG quality from 0.6 to 0.9
3. **Generate multiple frames**: Extract 5-6 frames spread across the video duration to create a filmstrip effect, rather than a single frame at the midpoint
4. **Display as repeating filmstrip**: Show multiple thumbnails side-by-side in the timeline clip instead of one stretched image

### Technical details

**`src/components/ad-director/editor/TimelineBar.tsx`**:

- `useVideoThumbnails` will return `Record<string, string[]>` (array of frame URLs per scene) instead of `Record<string, string>`
- Extract ~5 frames at evenly spaced intervals (0%, 20%, 40%, 60%, 80% of duration)
- Canvas: 320×180, JPEG quality 0.85
- In the timeline clip rendering (line ~379-390), display frames as a horizontal filmstrip using `display: flex` with multiple `<img>` elements instead of one stretched image

## Files changed
- `src/components/ad-director/editor/TimelineBar.tsx` — update thumbnail extraction and rendering

