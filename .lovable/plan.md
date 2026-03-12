

# Fix: Audio Overlapping, Missing Transitions, Voice Repeats in Pro Editor

## Problems Found

After auditing `ProVideoEditor.tsx` (lines 219-266, 528-550) and `videoStitch.ts`:

### 1. Voice overlaps — conditional cleanup return
The voiceover sync effect (line 219) only returns a cleanup function inside the `if (vo && isPlaying && !isMuted)` branch. The `else` branch (line 263) manually cleans up but returns **no cleanup function**. On rapid state changes (scene transitions, play/pause toggling), the old `Audio` instance can survive and overlap with a new one.

### 2. Voice repeats on scene auto-advance
`handleVideoEnded` (line 531) sets `autoPlayPending = true` then changes `selectedSceneIndex`. This triggers two effects simultaneously: the auto-play effect (line 212) calls `video.play()`, and the voiceover sync effect (line 221) creates a new Audio. The video's `onPlay` callback also sets `isPlaying(true)`, re-triggering the voiceover effect a second time — causing a duplicate Audio.

### 3. No visual transition between scenes in preview
The current "transition" (line 540) is just a 300ms CSS opacity toggle — fade to black, swap src, fade in. There is no crossfade between outgoing and incoming video in preview mode (crossfade only exists in export/stitch).

---

## Fixes — `src/components/ad-director/ProVideoEditor.tsx`

### Fix 1: Always return cleanup from voiceover effect
Restructure the effect so cleanup is **always** returned, regardless of which branch executes. Move the cleanup to the outer scope of the effect.

### Fix 2: Prevent double-trigger during auto-advance
Add a `sceneTransitioning` ref that is `true` during the 300ms transition. The voiceover effect checks this ref and skips starting audio while transitioning. Only after the transition completes and the new video begins playing does the voiceover start.

### Fix 3: Debounce voiceover creation
Add a 150ms debounce (`setTimeout`) before creating the Audio instance inside the voiceover effect. If the effect re-runs within that window (e.g., from `onPlay` re-triggering `isPlaying`), the previous timeout is cleared and only one Audio is created.

### Fix 4: Smoother scene transition with dual-video crossfade
Add a second hidden `<video>` element that preloads the next scene. On auto-advance:
- Start playing the next video (hidden) 
- Crossfade opacity over 500ms (outgoing fades out, incoming fades in)
- After crossfade, swap the primary video ref

This is a significant change. A simpler alternative: keep the CSS fade but extend it to 500ms and ensure the next video is preloaded before the fade-in begins.

**Recommended approach**: Keep the CSS opacity transition but fix the timing — preload the next scene's video before starting the fade, and delay the fade-in until `canplay` fires on the new src.

---

## Summary of changes — single file: `ProVideoEditor.tsx`

1. **Voiceover effect (lines 219-266)**: Restructure to always return cleanup. Add debounce timer ref. Check `sceneTransitioning` ref.
2. **Scene transition (lines 528-550)**: Add `sceneTransitioning` ref, extend fade to 500ms, wait for `canplay` before fade-in.
3. **Auto-play effect (lines 211-217)**: Gate on `!sceneTransitioning.current` to avoid race.

