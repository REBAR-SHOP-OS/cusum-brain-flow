

# Add 30s and 60s Duration Options to Video Studio

## What changes

Add "30s" and "60s" duration options to all three video generation modes (Fast, Balanced, Premium). The existing multi-scene system already handles durations exceeding the per-clip max by splitting into multiple scenes and generating them in parallel.

## Technical changes

### 1. `src/components/social/VideoStudioPromptBar.tsx`
- Update `durationOptionsMap` for all three modes to include `30` and `60` values
- These will appear in the duration popover dropdown

### 2. `src/components/social/VideoStudioContent.tsx`  
- Update `modeConfigs` `durationOptions` arrays to include `30` and `60`
- Update `maxClipDuration` — no change needed since multi-scene already kicks in when `requestedDuration > effectiveMaxClip`

### How it works (already implemented)
- When duration > `effectiveMaxClip` (8s for Wan, 8-12s for others), the system triggers `generate-multi` which splits into scenes automatically
- For 30s: ~4 scenes of 8s each (Balanced/Wan) or 3 scenes of 12s (Fast/Premium)  
- For 60s: ~8 scenes of 8s each (Balanced/Wan) or 5 scenes of 12s (Fast/Premium)

