

## Stabilize Voice Vizzy

### Problems Identified

1. **Stale closure in `onDisconnect`** -- The `transcript` state captured in the `useConversation` config is always the initial empty array, so transcripts are never saved on disconnect.
2. **Config object recreated every render** -- The options object passed to `useConversation` is not stable, potentially causing SDK re-initialization.
3. **SmartErrorBoundary remounts on retry** -- When the boundary auto-retries, it remounts `VoiceVizzyInner`, creating a NEW SDK instance while the old WebRTC connection may still be alive. This causes the "double connected" logs.
4. **No safe guards around `endSession`** -- If the SDK is already crashed/disconnected, `endSession()` throws an unhandled error.
5. **VizzyPage has `conversation` in useEffect deps** -- `useConversation` returns a new object reference each render, causing the auto-start effect to re-trigger.

### Fix Plan

**File: `src/components/vizzy/VoiceVizzy.tsx`**
- Use a `transcriptRef` (useRef) alongside the state to always have the latest transcript available in the `onDisconnect` callback
- Wrap `endSession()` in try/catch in the `stop` callback
- Add a `sessionActiveRef` guard to prevent double-starting

**File: `src/pages/VizzyPage.tsx`**
- Same `transcriptRef` pattern for the `onDisconnect` and `saveTranscript` callbacks
- Remove `conversation` from the `useEffect` dependency array (it's a stable ref from the hook but the object identity changes -- use a ref to call `startSession`)
- Wrap `endSession()` in try/catch
- Add a `sessionActiveRef` to prevent race conditions

**File: `src/components/layout/AppLayout.tsx`**
- Change `SmartErrorBoundary` to `maxAutoRetries={0}` for VoiceVizzy -- auto-retrying a voice SDK component causes duplicate sessions. On error, just silently hide it instead of remounting.

### Technical Details

```text
VoiceVizzy.tsx changes:
  - Add: const transcriptRef = useRef<TranscriptEntry[]>([])
  - In setTranscript calls, also update transcriptRef.current
  - In onDisconnect, read from transcriptRef.current instead of transcript
  - In stop(), wrap endSession in try/catch
  - Add sessionActiveRef to prevent double start

VizzyPage.tsx changes:
  - Same transcriptRef pattern
  - Store conversation methods in a ref to avoid useEffect re-runs
  - Wrap endSession in try/catch
  - Add sessionActiveRef guard

AppLayout.tsx changes:
  - maxAutoRetries={0} on the VoiceVizzy boundary
```

These are all surgical fixes -- no UI changes, no new dependencies, no changes to other components.

