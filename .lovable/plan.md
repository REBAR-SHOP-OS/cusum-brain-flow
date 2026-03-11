

## Improve Video Generation Progress UI

The video generation is working correctly -- Sora just takes 3-5 minutes per scene and doesn't report granular progress. The UI shows "0% complete" the entire time, making it look stuck.

### Changes to `VideoGeneratorDialog.tsx`

1. **Add a `startedAt` ref** to track when generation began
2. **Show elapsed time** instead of misleading "0% complete" when no scene progress exists
3. **Show a time-based fake progress bar** that smoothly fills to ~80% over the expected duration (Sora ~4min/scene, Veo ~2min), then holds until real completion
4. **Add provider-specific messaging**: "Sora typically takes 3-5 minutes per scene" vs "Veo typically takes 1-2 minutes"
5. **Add a subtle pulsing animation** to the progress text so it's clear something is happening
6. **Show a "Cancel" button** during generation so users aren't trapped

### Specific UI updates (lines 542-564):

- Replace static `{Math.round(progress)}% complete` with elapsed time: "2m 15s elapsed"
- When `progress === 0` and `completedScenes === 0`, show estimated time based on provider + scene count instead of the meaningless 0%
- Simulate smooth progress: `min(80, (elapsed / estimatedTotal) * 80)` so the bar moves
- Add provider context: "Sora processes each scene independently (3-5 min each)"
- Add cancel button to `cleanup()` and reset state

### No backend changes needed
The polling logic is correct. This is purely a frontend UX improvement.

