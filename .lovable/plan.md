
# Fix: "WebSocket is not connected" Error — Complete Rewrite of Voice Logic

## Root Cause (Confirmed by SDK Source Analysis)

The `useScribe` hook from `@elevenlabs/react` stores the connection in a `ref` (`B.current`). When the SDK fires an error event, it sets the internal status to `"error"` but does **not** automatically close/null out `B.current`. This means:

1. `scribe.isConnected` becomes `false` (since it only returns `true` for `"connected"` or `"transcribing"` states)
2. But `B.current` is still alive/closing underneath
3. When our code calls `safeDisconnect()` → `scribe.disconnect()`, the SDK calls `B.current.close()` on an already-closing socket → **crash**
4. The error propagates through the SDK's `onError` handler → toast fires again → infinite loop of error toasts

## Solution: Rewrite using `status` field + proper guard

The SDK exposes a `status: ScribeStatus` field (`"disconnected" | "connecting" | "connected" | "transcribing" | "error"`). The fix requires:

1. **Use `scribe.status` instead of `scribe.isConnected`** to guard all state transitions — only disconnect when status is NOT already `"disconnected"` or `"error"`
2. **Remove the `safeDisconnect` pattern** — replace it with a status-aware guard directly checking `scribe.status`
3. **Stop re-throwing errors** — add an `onError` callback to the `useScribe` options to catch errors at the source and prevent them from propagating as uncaught exceptions
4. **Use `scribe.partialTranscript` (built-in)** instead of maintaining a separate `interimText` state — the SDK already tracks this
5. **Reset on dialog close** via `scribe.clearTranscripts()` to wipe old interim text

## Technical Details

**File: `src/components/feedback/AnnotationOverlay.tsx`**

### Change 1 — `useScribe` with `onError` handler + use built-in `partialTranscript`
```typescript
const scribe = useScribe({
  modelId: "scribe_v2_realtime",
  commitStrategy: CommitStrategy.VAD,
  onPartialTranscript: (data) => {
    // handled via scribe.partialTranscript (built-in)
  },
  onCommittedTranscript: (data) => {
    setDescription((prev) => (prev + " " + data.text).trim());
  },
  onError: (err) => {
    // Catch all WebSocket errors at source — prevents uncaught errors
    console.warn("[Scribe] error:", err);
  },
});
```

### Change 2 — Status-aware disconnect guard
```typescript
const disconnectIfActive = useCallback(() => {
  // Only disconnect if NOT already disconnected/error (avoids double-disconnect crash)
  if (scribe.status !== "disconnected" && scribe.status !== "error") {
    try { scribe.disconnect(); } catch { /* ignore */ }
  }
  scribe.clearTranscripts(); // wipe interim text
}, [scribe]);
```

### Change 3 — `toggleVoice` with `status`-based guard
```typescript
const toggleVoice = useCallback(async () => {
  if (scribe.status === "connected" || scribe.status === "transcribing" || scribe.status === "connecting") {
    disconnectIfActive();
    return;
  }
  if (scribe.status === "connecting") return; // already connecting
  try {
    setVoiceConnecting(true);
    await navigator.mediaDevices.getUserMedia({ audio: true });
    const { data, error } = await supabase.functions.invoke("elevenlabs-scribe-token");
    if (error || !data?.token) throw new Error("Could not get scribe token");
    await scribe.connect({
      token: data.token,
      microphone: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch (err: any) {
    console.error("Voice error:", err);
    toast.error("Could not start voice input: " + (err.message ?? "Unknown error"));
  } finally {
    setVoiceConnecting(false);
  }
}, [scribe, disconnectIfActive]);
```

### Change 4 — Remove `isConnectingRef`, `interimText` state, `voiceConnecting` improvements
- Remove `isConnectingRef` (no longer needed — SDK `status` is the source of truth)
- Remove `interimText` state — use `scribe.partialTranscript` (built-in, always accurate)
- Keep `voiceConnecting` state for spinner UI during the async token fetch
- Voice button shows active state when `scribe.status === "connected" || "transcribing"`

### Change 5 — Dialog close effect
```typescript
useEffect(() => {
  if (!open) {
    disconnectIfActive();
  }
}, [open, disconnectIfActive]);
```

### Change 6 — UI: show `scribe.partialTranscript` directly
```tsx
{scribe.partialTranscript && (
  <div className="mt-1 text-xs italic text-muted-foreground px-1 animate-pulse">
    🎙 {scribe.partialTranscript}
  </div>
)}
```

## Summary

| What | Before | After |
|------|--------|-------|
| Connection guard | `isConnected` boolean (stale) | `scribe.status` (always fresh) |
| Error handling | Uncaught → repeated toasts | `onError` callback catches at source |
| Interim text | Separate `interimText` state | `scribe.partialTranscript` (built-in) |
| Disconnect safety | `try/catch` wrapper | Status check before disconnect |
| Race conditions | `isConnectingRef` ref | Not needed — `status === "connecting"` |

Only one file changes: `src/components/feedback/AnnotationOverlay.tsx`
