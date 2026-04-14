

## Plan: Fix Vizzy Can't Hear — Revert Aggressive Recognition Nullification

### Problem
The previous "reconnect loop fix" nullifies `recognitionRef.current` and `activeRef.current` when `not-allowed` fires. On some devices this fires transiently or on session restart, permanently killing STT for the session. The `onend` handler can't restart because `recognitionRef.current` is null.

### Changes

**1. Patch: `src/hooks/useVizzyStreamVoice.ts`** (lines 339-350)

Remove the two nullification lines. Keep the error message and state change so the UI still shows a clear error, but let the normal `onend` restart cycle attempt recovery:

```typescript
recognition.onerror = (event: any) => {
  if (event.error === "aborted") return;
  console.error("[VizzyStream] STT error:", event.error);
  if (event.error === "not-allowed") {
    setErrorDetail("Microphone access denied — check browser permissions");
    setState("error");
    return;
  }
};
```

The auto-retry skip in `VizzyVoiceChat.tsx` (checking for "microphone"/"denied" in `lastErrorDetail`) remains — that's still correct and prevents UI-level retry spam for genuine permission blocks.

### What does NOT change
- VizzyVoiceChat auto-retry skip for mic errors — still in place
- TTS chunking, audio queue — unchanged
- Session lifecycle — unchanged

### Result
Recognition can attempt restart after transient `not-allowed` errors. Genuine permission blocks still show the error message and skip UI auto-retry.

