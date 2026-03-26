

# Enforce Scene Count Based on Duration (Root Fix)

## Problem
The AI sometimes returns more or fewer scenes than expected for the selected duration. For a 15s video, it should create exactly 1 scene; 30s → 2 scenes; 60s → 4 scenes. The screenshot shows a 15s video with 2 scene cards.

## Root Cause
The `sceneCount` is calculated correctly at line 223 of `backgroundAdDirectorService.ts` and passed to the AI as an instruction, but there is no **enforcement** after the AI responds. If the AI ignores the constraint, the wrong number of scenes flows through.

## Solution
Add a post-AI enforcement step in `backgroundAdDirectorService.ts` that trims or pads the storyboard + segments to match the expected scene count, right after receiving the AI response (line 231).

## Changes

### `src/lib/backgroundAdDirectorService.ts`

After line 231 (`const { segments: newSegments, storyboard: rawStoryboard, continuityProfile } = analyzeResult.result;`), add enforcement logic:

1. **Calculate expected scene count** from `videoParams.duration` (same formula as line 223)
2. **If AI returned too many scenes**: truncate `rawStoryboard` and `newSegments` to the expected count, adjusting the last segment's `endTime` to match `videoParams.duration`
3. **If AI returned too few scenes**: duplicate the last scene to fill the gap, assigning correct timing (each scene = 15s)
4. **Recalculate segment timings**: ensure segments are evenly spaced at 15s intervals matching the enforced scene count

```text
Expected behavior:
  duration=15  → exactly 1 scene  (0-15s)
  duration=30  → exactly 2 scenes (0-15s, 15-30s)
  duration=60  → exactly 4 scenes (0-15s, 15-30s, 30-45s, 45-60s)
```

### Also fix segment timing recalculation
Segments' `startTime`/`endTime` must be recalculated to match the enforced scene count × 15s per scene, ensuring the video player and scene cards display correct timings.

| File | Change |
|---|---|
| `src/lib/backgroundAdDirectorService.ts` | Add scene count enforcement after AI response — trim/pad storyboard + segments to match expected count based on duration |

