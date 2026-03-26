

# Resize Video Preview, Fix Logo Position & Apply Logo to All Scenes

## What
1. The video preview canvas area in the editor is too large — reduce its size to a medium proportion
2. The logo watermark overlay is centered (position x:35, y:40) for intro/outro scenes — move it to bottom-right corner
3. Logo should be applied to ALL scenes automatically, not just intro/outro scenes

## Changes

### 1. Reduce video preview size — `ProVideoEditor.tsx`
The center canvas area (`flex-1`) fills all remaining space. Constrain the video preview with a max-height so it doesn't dominate the viewport:
- Add `max-h-[50vh]` to the video container div (line 1131) so it takes roughly half the viewport height
- This leaves more room for the timeline below

### 2. Fix logo overlay position — `ProVideoEditor.tsx`
In the auto-seed logo overlay effect (lines 205-209), change the position from center `{ x: 35, y: 40 }` to bottom-right `{ x: 82, y: 85 }` and reduce size from `{ w: 30, h: 20 }` to `{ w: 12, h: 10 }`.

### 3. Apply logo to ALL scenes — `ProVideoEditor.tsx`
Change the auto-seed logic (lines 195-200) to apply to **all** scenes instead of filtering only intro/outro/hook/closing scenes. Remove the `introOutroScenes` filter — iterate over all `storyboard` scenes and seed a logo overlay for any scene that doesn't already have one.

### 4. Keep stitch logo position consistent — `videoStitch.ts`
The `drawLogo` function already draws at bottom-right (line 185). No change needed there — it's correct.

### 5. Keep `videoWatermark.ts` consistent
Already draws at bottom-right. No change needed.

| File | Change |
|---|---|
| `src/components/ad-director/ProVideoEditor.tsx` | Constrain video preview height; change auto-seed logo to all scenes with bottom-right position and smaller size |

