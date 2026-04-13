

# Fix: Vizzy Voice "Connection failed" — WebRTC Stability

## Root Cause Analysis

The edge function logs confirm the token is generated successfully every time. The failure happens **after** the token — during WebRTC negotiation. Two issues identified:

### Issue 1: "disconnected" treated as fatal error
In `useVizzyRealtimeVoice.ts` line 297, the `onconnectionstatechange` handler treats both `"failed"` and `"disconnected"` as terminal errors. In WebRTC, `"disconnected"` is often a **temporary** state that can recover on its own within seconds. Treating it as fatal triggers cleanup and error state prematurely.

### Issue 2: No overall connection timeout
If the SDP exchange succeeds but `session.created` never arrives on the data channel (e.g., data channel opens slowly, or OpenAI delays), the UI stays stuck in "connecting" indefinitely until the PC connection eventually fails.

## Fix Plan

### `src/hooks/useVizzyRealtimeVoice.ts`

1. **Separate "disconnected" from "failed"**: Only treat `"failed"` as a terminal error. For `"disconnected"`, start a 5-second grace timer — if the state recovers to `"connected"` within that window, cancel the timer. If it doesn't recover, then trigger error.

2. **Add overall connection timeout (20s)**: After SDP exchange completes, start a 20-second timer. If `session.created` hasn't been received by then, treat it as a connection failure with a clear error message.

3. **Add `"connecting"` state to `onconnectionstatechange`**: Log the `"connecting"` WebRTC state for visibility.

4. **Increase ICE gathering timeout**: Change from 10s to 15s in the `waitForIceGatheringComplete` call to give more time on slower networks.

### `src/components/vizzy/VizzyVoiceChat.tsx`

5. **Increase auto-retry count from 2 to 3**: Give one more retry attempt since the root cause is often transient network issues.

## Files to Edit
| File | Change |
|------|--------|
| `src/hooks/useVizzyRealtimeVoice.ts` | Grace period for "disconnected", connection timeout, increase ICE timeout |
| `src/components/vizzy/VizzyVoiceChat.tsx` | Increase MAX_AUTO_RETRIES to 3 |

## Risk
- Low — only affects WebRTC connection resilience
- No backend changes
- No schema changes

