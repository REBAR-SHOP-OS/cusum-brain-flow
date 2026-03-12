

# Fix: Voiceover/Video Timing Imbalance and Playback Glitches

## Problems Identified

1. **Video ends, voiceover gets cut**: When the video clip finishes and advances to the next scene, the voiceover cleanup kills the Audio instance mid-sentence. The `handleVideoEnded` tries to wait for VO, but the scene transition cleanup at line 256-261 runs and destroys the audio anyway — because `selectedSceneIndex` changes, triggering the playback effect cleanup.

2. **`isMuted` defaults to `true` (line 98)**: Voiceover never plays until user explicitly unmutes, since line 267 returns early when `isMuted` is true. This causes confusion — user sees a VO track but hears nothing.

3. **Playback rate cap too low**: When VO is longer than clip, max speedup is 1.3x (line 282). A 6s VO on a 4s clip needs 1.5x. The cap should be higher or the video should pause/extend.

4. **Scene transition destroys audio prematurely**: `advanceToNextScene` sets `selectedSceneIndex` → triggers the playback effect → cleanup kills current VO before it finishes, even though `handleVideoEnded` tried to wait.

5. **150ms debounce adds latency**: Every scene change delays VO start by 150ms while the video starts immediately, creating visible desync.

## Solution

### A. Let voiceover finish before advancing (don't rely on effect cleanup)
In `advanceToNextScene`, **don't change `selectedSceneIndex` until VO ends**. Move the "wait for VO" logic into `advanceToNextScene` itself, not `handleVideoEnded`. Pause the video at its last frame while waiting.

### B. Change `isMuted` default to `false`
Users expect audio to play. Change line 98 from `true` to `false`.

### C. Increase playback rate cap to 1.6x
Change line 282 cap from `1.3` to `1.6` — still sounds natural but covers more timing gaps.

### D. Reduce debounce from 150ms to 50ms
The 150ms was to prevent double-trigger, but the `cancelled` flag + early-return guard already handle that. 50ms is enough buffer.

### E. Sync voiceover start to video `canplay` event instead of debounce
For video scenes, start the VO when the video actually begins playing (on `playing` event), not on a fixed timer. This eliminates the desync gap.

### Concrete Changes — `src/components/ad-director/ProVideoEditor.tsx`

**Line 98**: `isMuted` default `true` → `false`

**Line 267**: Add a ref `voFinishingRef` to track when VO is completing across scene transition.

**Lines 272-305 (debounce block)**: 
- Reduce timeout to 50ms
- For video scenes, listen for `playing` event on videoRef to start VO in sync
- Increase playback rate cap from 1.3 → 1.6

**Lines 640-677 (advanceToNextScene)**:
- Before changing `selectedSceneIndex`, check if VO is still playing
- If so, pause video at last frame, attach `onended` to VO, then advance when VO finishes
- This prevents the scene index change from triggering cleanup while VO plays

**Lines 679-687 (handleVideoEnded)**:
- Simplify — the "wait for VO" logic moves into `advanceToNextScene`

