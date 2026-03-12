

## Video Studio -- Audit & Improvements

After reviewing the full codebase and current UI state, here are the bugs and UX issues identified, with fixes:

### Bugs Found

1. **Prompt bar disappears after video completion** -- Line 809 only shows the bar when `status === "idle" || "transforming"`. After a video completes, users must click Reset to generate again. Fix: always show prompt bar except during active video processing.

2. **Duration mismatch when switching media types** -- Video defaults to "8" but audio options are 5/15/30. Switching to audio mode keeps "8" as duration, which doesn't match any audio option. Fix: reset duration to a valid default when switching media type.

3. **Video results bleed into Image/Audio modes** -- If a video is completed (`status === "completed"`) and user clicks Image mode icon, the completed video UI still renders (guarded by `status === "completed" && videoUrl`). Fix: gate video results by `mediaType === "video"`.

4. **Error state persists across mode switches** -- If video fails, then user switches to Image mode, the error block still shows (`status === "failed"`). Fix: gate error display by mediaType or clear status on mode switch.

5. **Audio type state shared between video-audio-section and audio-mode** -- `audioType` is used both by the post-completion "Add Audio/Music" section and the standalone Audio mode. Changing it in one affects the other. Fix: use separate state for standalone audio type.

### UX Improvements

6. **Show prompt bar persistently** -- Always visible at bottom, even after results. Allows quick re-generation without resetting.

7. **Clear stale results on mode switch** -- When switching from video→image, reset video status to idle and clear video results.

8. **Add "New Generation" button** next to Reset on completed states, to keep the result visible while starting fresh in the prompt bar.

### Implementation

**File: `VideoStudioContent.tsx`**

- Line 809: Change condition to show prompt bar always except during active video processing/submitting
- Line 834 `onMediaTypeChange`: Also reset `status` to idle, clear `videoUrl`
- Lines 549, 682, 718: Add `mediaType === "video" &&` guard to video-specific result blocks
- Add duration auto-correction in `onMediaTypeChange`: set "15" for audio, "8" for video, "1" for image credit display
- Separate `standaloneAudioType` state from `audioType`

**File: `VideoStudioPromptBar.tsx`**
- No structural changes needed, just ensure props flow correctly

### Estimated changes: ~30 lines modified in `VideoStudioContent.tsx`

