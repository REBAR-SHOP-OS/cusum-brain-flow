

# Fix: User-Selected Duration and Ratio Must Be Enforced in Video Generation

## Problem
When the user selects a duration (15s, 30s, 1min) and ratio (16:9, 9:16, 1:1, 4:3) in the chat bar, these values are **not properly passed** to the video generation pipeline:

1. The `duration` string from ChatPromptBar is received by `startPipeline` but **never stored or used** — line 329 uses `videoParams.duration` which defaults to `5`
2. The `videoParams` object constructed on line 85 of `AdDirectorContent.tsx` only overrides `ratio`, keeping `duration: 5` from defaults
3. For 30s/60s videos, scene durations must be **distributed across scenes** (Wan API max is 15s/clip), but currently each scene gets 5s

## Fix

### 1. Store user-selected duration in pipeline state (`backgroundAdDirectorService.ts`)

- Add `userDuration: number` to `AdDirectorPipelineState` (parsed from the "15"/"30"/"60" string)
- In `startPipeline`, parse `duration` string → number and store it
- In scene generation (line 329), calculate per-scene duration:
  - `perSceneDuration = Math.min(15, Math.ceil(userDuration / numberOfScenes))`
  - This ensures total video ≈ user-selected duration, with each clip ≤ 15s (Wan limit)

### 2. Pass duration properly from `AdDirectorContent.tsx`

- Update line 85 to include parsed duration: `{ ...currentVideoParams, ratio, duration: parseInt(duration) || 15 }`

### 3. Pass duration to analyze-script for correct scene planning

- Include `targetDuration` in the analyze-script call so the AI plans the right number of scenes for the total duration (e.g., 4 scenes for 60s, 2 for 30s, 1-2 for 15s)

## Files Changed

| File | Change |
|---|---|
| `src/lib/backgroundAdDirectorService.ts` | Add `userDuration` to state, parse duration param, use it for per-scene duration calculation, pass to analyze-script |
| `src/components/ad-director/AdDirectorContent.tsx` | Pass parsed duration into videoParams |

