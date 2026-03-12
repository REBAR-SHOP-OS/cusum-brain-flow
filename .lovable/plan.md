

# Fix Voice Issues: Echo, Cutting Off, Speed Mismatch

## Problems Identified

### 1. Echo / Repeat
When the video fires `playing` event multiple times (buffering, seeking), the `onPlaying` handler (line 296) re-starts the voiceover from the video's current time. Combined with the drift correction sync (line 311-314), this can cause the VO to jump back and replay sections. Additionally, when a scene advances and the playback effect re-runs, a stale `onPlaying` listener on the old video element could fire, creating overlapping audio.

### 2. Voice Cuts Mid-Sentence
When video ends before VO finishes, the orphan logic pauses the video (line 669) and waits for VO to complete. But the visual freeze makes the user perceive the audio as "cut" — the experience is jarring. The VO should have already been speed-matched to fit the clip.

### 3. Speed Issues
The `clipDurations` map is populated in `handleLoaded` (line 640), but voiceovers are generated on mount (line 204-210) before any video has loaded. So during `generateAllVoiceovers`, `clipDurations[scene.id]` is always `undefined`, making the two-pass fitting logic a no-op.

## Solution

### A. Fix VO generation timing — wait for clip durations
In `generateAllVoiceovers`, for each scene, check if we know the clip duration. If not, measure it from the clip URL before doing the two-pass fit. This ensures VO speed is always matched to the actual clip length.

**`ProVideoEditor.tsx` — `generateAllVoiceovers` (lines 760-827):**
- Before generating VO for a scene, look up the clip and measure its duration if not in `clipDurations`
- Use the measured duration for the two-pass speed fitting

### B. Fix echo — guard `onPlaying` to fire only once
The `onPlaying` handler should use a flag to ensure it fires exactly once per scene, preventing re-triggers from buffering events.

**`ProVideoEditor.tsx` — playback effect (lines 272-324):**
- Add `let voStarted = false;` guard
- In `onPlaying` and the immediate-play branch, set `voStarted = true` and skip if already true
- Remove the drift correction sync entirely — it causes more problems than it solves (the VO is speed-matched to the clip, so drift is minimal)

### C. Fix orphan stale listeners — clean up video event listeners before orphaning
When `advanceToNextScene` orphans the audio, the `timeupdate` sync handler from the playback effect is still attached to the video element. It should be cleaned up.

**`ProVideoEditor.tsx` — `advanceToNextScene` (lines 654-721):**
- Instead of orphaning VO (which leaves a playing audio with no control), immediately pause it. The VO is already speed-matched, so if it didn't fit, that's acceptable — cutting 0.2s of VO is better than freezing the video for 2s.
- Remove the orphan/wait pattern: just stop VO cleanly and advance immediately

### D. Helper: measure clip duration from URL
Add a `measureVideoDuration` helper (similar to `measureAudioDuration`) to get the duration from a video clip URL before generating its VO.

## Files Changed

- `src/components/ad-director/ProVideoEditor.tsx` — all fixes above

