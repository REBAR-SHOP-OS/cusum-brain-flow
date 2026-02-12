

# Fix: Caller Can't Hear AI Audio

## Root Cause

The most likely issue is **AudioContext suspension**. Modern browsers create `AudioContext` instances in a `suspended` state by default and require explicit `.resume()` calls. The code creates two AudioContexts (`captureCtx` at 16kHz and `outputCtx` at 48kHz) but never calls `.resume()` on either. This means:

- **outputCtx suspended** = AI audio chunks are decoded and scheduled but never actually play through the `MediaStreamAudioDestinationNode`, so the replaced outgoing track produces silence
- **captureCtx suspended** = remote caller audio is never captured and sent to ElevenLabs, so the AI thinks nobody is speaking (hence "Are you still there?")

## Fix

**File: `src/hooks/useCallAiBridge.ts`**

Add explicit `.resume()` calls on both AudioContexts immediately after creation:

```typescript
// After creating captureCtx (line ~87)
const captureCtx = new AudioContext({ sampleRate: 16000 });
await captureCtx.resume();  // <-- ADD THIS

// After creating outputCtx (line ~91)  
const outputCtx = new AudioContext({ sampleRate: 48000 });
await outputCtx.resume();   // <-- ADD THIS
```

Also add a safety `.resume()` inside `playAiAudioChunk` in case the context gets suspended mid-call:

```typescript
function playAiAudioChunk(...) {
  // Resume if suspended
  if (outputCtx.state === 'suspended') {
    outputCtx.resume();
  }
  // ... rest of function
}
```

Additionally, add diagnostic logging to `replaceOutgoingTrack` to confirm the track replacement succeeds and the AI track is live:

```typescript
function replaceOutgoingTrack(pc, aiStream) {
  // ... existing code ...
  if (aiTrack) {
    console.log("AI bridge: replacing track, AI track enabled:", aiTrack.enabled, "readyState:", aiTrack.readyState);
    audioSender.replaceTrack(aiTrack)
      .then(() => console.log("AI bridge: track replaced successfully"))
      .catch(e => console.error("AI bridge: failed to replace track", e));
  }
}
```

## Technical Summary

| Change | File | Purpose |
|--------|------|---------|
| `await captureCtx.resume()` | useCallAiBridge.ts | Ensure caller audio capture works |
| `await outputCtx.resume()` | useCallAiBridge.ts | Ensure AI audio plays to caller |
| Safety resume in playAiAudioChunk | useCallAiBridge.ts | Guard against mid-call suspension |
| Diagnostic logging in replaceOutgoingTrack | useCallAiBridge.ts | Confirm track swap succeeds |

