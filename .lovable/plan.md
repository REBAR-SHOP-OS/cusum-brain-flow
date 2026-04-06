

# Stabilize Vizzy Voice Session

## Current Stability Issues

1. **Single auto-reconnect** — only retries once on disconnect, then gives up permanently
2. **No ICE state monitoring** — only watches `connectionstatechange`, misses ICE failures
3. **No data channel close detection** — if DC closes silently, session hangs with no recovery
4. **No network change detection** — switching WiFi or losing connectivity causes silent death
5. **No keepalive/heartbeat** — stale connections not detected until OpenAI drops them
6. **Error state is terminal** — requires manual "Retry" tap; no auto-recovery

## Plan

### File: `src/hooks/useVoiceEngine.ts`

**a) Exponential auto-reconnect (up to 3 attempts)**
- Replace the single `hasAutoReconnected` boolean with a counter (`reconnectAttempts`)
- On disconnect: wait 1.5s, 3s, 6s between retries (exponential backoff)
- After 3 failures, show error state
- Reset counter on successful `session.created`

**b) ICE connection state monitoring**
- Add `pc.oniceconnectionstatechange` handler
- On `"failed"` → trigger reconnect flow
- On `"disconnected"` → start a 5s grace timer; if not recovered, reconnect

**c) Data channel close/error detection**
- Add `dc.onclose` and `dc.onerror` handlers
- On unexpected close → trigger reconnect

**d) Network change listener**
- Listen to `window.addEventListener("online", ...)` 
- When network comes back online after being offline → auto-reconnect

**e) Keepalive ping every 30s**
- Send a small `input_audio_buffer.clear` message on the data channel every 30s to keep the connection alive and detect stale connections early
- If send throws → trigger reconnect

### File: `src/components/vizzy/VizzyVoiceChat.tsx`

**f) Auto-retry on error state**
- When `voiceState === "error"`, auto-retry after 3s (up to 2 times) before showing manual retry button
- Show "Reconnecting..." status during auto-retry

## Files Changed
- `src/hooks/useVoiceEngine.ts`
- `src/components/vizzy/VizzyVoiceChat.tsx`

