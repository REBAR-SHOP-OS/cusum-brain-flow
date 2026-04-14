

## Plan: Fix Vizzy Voice Reconnect Loop on Mic Permission Denied

### Problem
When microphone permission is denied, `SpeechRecognition` fires `onerror("not-allowed")` → sets state to `"error"` → `onend` fires and restarts recognition (line 350) → infinite error loop. The auto-retry in VizzyVoiceChat compounds this by retrying 3 times, but permission errors never self-resolve.

### Changes

**1. Patch: `src/hooks/useVizzyStreamVoice.ts`**

In `recognition.onerror` (line 339–346): When error is "not-allowed", null out `recognitionRef.current` BEFORE setting state to "error". This prevents `onend` from restarting recognition.

```typescript
recognition.onerror = (event: any) => {
  if (event.error === "aborted") return;
  console.error("[VizzyStream] STT error:", event.error);
  if (event.error === "not-allowed") {
    // Prevent onend from restarting — permission errors won't self-resolve
    recognitionRef.current = null;
    activeRef.current = false;
    setErrorDetail("Microphone access denied — check browser permissions");
    setState("error");
  }
};
```

**2. Patch: `src/components/vizzy/VizzyVoiceChat.tsx`**

In the auto-retry effect (lines 228–235): Skip auto-retry when `lastErrorDetail` contains "Microphone" or "denied" — these errors require user action, not retries.

```typescript
useEffect(() => {
  const isMicError = lastErrorDetail?.toLowerCase().includes("microphone") 
    || lastErrorDetail?.toLowerCase().includes("denied");
  if (isError && !isMicError && autoRetryCountRef.current < MAX_AUTO_RETRIES) {
    // ... existing retry logic
  }
}, [isError, startSession, lastErrorDetail]);
```

Update `statusText` to show mic-specific message when applicable:
```typescript
} else if (isError && lastErrorDetail?.includes("Microphone")) {
  statusText = "Microphone access denied";
```

### File summary

| File | Action |
|---|---|
| `src/hooks/useVizzyStreamVoice.ts` | Patch — stop restart loop on mic permission denied |
| `src/components/vizzy/VizzyVoiceChat.tsx` | Patch — skip auto-retry for permission errors, show correct status |

### What does NOT change
- TTS chunking, audio queue, playBase64Audio — all unchanged
- personaplex-voice edge function — unchanged
- Session lifecycle for non-permission errors — unchanged
- UI layout and styling — unchanged

### Result
Permission denial shows a clear "Microphone access denied" message with no infinite retry loop. Network/transient errors still auto-retry as before.

