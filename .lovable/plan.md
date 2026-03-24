

## Add Voice Message Recording to Team Hub Chat

### What
Add a **record and send voice message** button to the chat composer. Users hold/click to record audio, then send it as an audio attachment. Voice messages display as inline audio players in the message thread.

### Changes

**New Hook**: `src/hooks/useVoiceRecorder.ts`
- Wraps `MediaRecorder` API (reuses the same pattern from `useMeetingRecorder.ts`)
- Exposes: `isRecording`, `duration`, `startRecording()`, `stopRecording() → Blob`
- Records as `audio/webm;codecs=opus` (with fallback)
- Tracks duration with interval timer
- Cleans up stream tracks on stop

**File**: `src/components/teamhub/MessageThread.tsx`

1. Import `useVoiceRecorder` hook and `Mic` icon
2. Add a **microphone record button** next to the existing voice-to-text button:
   - Click once to start recording → button turns red with pulse animation + shows duration timer
   - Click again to stop → uploads the audio blob to `team-chat-files` storage as `voice-{timestamp}.webm`
   - Automatically sends the voice file as an attachment (type `audio/webm`)
3. During recording, show a small red recording indicator with elapsed time (e.g., "🔴 0:12")
4. Add a cancel option (X button) to discard the recording

3. **Audio playback in messages**: The existing attachment rendering already handles non-image files with a download link. Update the attachment render to detect `audio/*` types and render an inline `<audio controls>` player instead of just a download link.

### UI Layout (composer bottom bar)
```text
[😀] [🎤 voice-to-text] [🎙️ record voice] [📎] [Aa] [IR فارسی]     [Send]
```

When recording:
```text
[🔴 0:12 recording...] [✕ cancel]                                  [⏹ Stop & Send]
```

### Files Changed

| File | Change |
|---|---|
| `src/hooks/useVoiceRecorder.ts` | New hook for audio recording (MediaRecorder) |
| `src/components/teamhub/MessageThread.tsx` | Add record button, recording UI, audio player for voice attachments |

