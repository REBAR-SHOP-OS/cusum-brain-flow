

# Unblock 5×8s Video Generation

## Problems Found

1. **Duration ignored**: `generateScene` (line 407-408) calculates duration from script segment timing and caps at 15s, completely ignoring `videoParams.duration`. The user's selected 8s is never used.
2. **Build Quantity disabled**: The slider is locked with "Coming soon" and capped at max=4. User needs 5 builds.
3. **Duration slider max=30 but provider max=15**: Misleading — Wan 2.6 supports max 15s clips.

## Changes

### 1. `src/components/ad-director/VideoParameters.tsx`
- Enable Build Quantity control (remove `disabled`, remove "Coming soon" label)
- Increase max from 4 → 10 so user can set 5
- Fix duration max from 30 → 15 to match Wan 2.6 provider limit

### 2. `src/components/ad-director/AdDirectorContent.tsx`
- In `generateScene` (line 407-408): use `videoParams.duration` instead of segment timing as the clip duration. Fallback to segment timing only if videoParams isn't set.
- In `handleGenerateAll`: respect `videoParams.buildQty` — for each scene, launch `buildQty` parallel generations (each with the same prompt but unique clip IDs), giving the user multiple variations to pick from.

### 3. Wire buildQty through clips state
- When `buildQty > 1`, create multiple clip entries per scene (e.g. `sceneId-v1`, `sceneId-v2`, etc.) so each variant tracks independently in the UI.

### Files
- `src/components/ad-director/VideoParameters.tsx` — enable buildQty, fix duration max
- `src/components/ad-director/AdDirectorContent.tsx` — use videoParams.duration, implement multi-build generation

