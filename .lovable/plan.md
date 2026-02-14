

# Fix Vizzy Voice Reconnection Loop

## Problem Analysis

The logs show a clear pattern causing an infinite reconnect loop:

1. WebRTC room connects successfully
2. ElevenLabs agent participant disconnects almost immediately (server-side)
3. `onDisconnect` fires and triggers a reconnect with a new token
4. New session connects, agent disconnects again -- loop repeats 3 times

The root cause: Each reconnect attempt creates a brand new ElevenLabs conversation. The agent connects briefly, then the server-side agent disconnects (likely because of the large context being sent before the agent is fully ready, or because rapid successive connections trigger ElevenLabs rate limiting). The current code treats EVERY disconnect as a recoverable network issue, but agent-initiated disconnects should not trigger reconnection.

## Solution

### 1. Add connection stability guard (`src/pages/VizzyPage.tsx`)

Only attempt reconnection if the session was stable for at least 5 seconds. If the agent disconnects within seconds of connecting, it means the agent itself ended the session -- reconnecting will just repeat the same failure.

### 2. Add cooldown between reconnection attempts

Prevent rapid token requests by enforcing a minimum 3-second gap between reconnection attempts. This prevents burning through ElevenLabs quota with rapid-fire token requests.

### 3. Don't send context until agent speaks or 3 seconds pass

Delay `sendContextualUpdate` slightly after connection to let the WebRTC session fully stabilize before pushing large payloads.

## Technical Details

### Changes to `src/pages/VizzyPage.tsx`

**onConnect handler (line ~243)**:
- Record `lastConnectTime` timestamp when connection succeeds

**onDisconnect handler (line ~248)**:
- Check if session lasted less than 5 seconds -- if so, treat as agent-initiated disconnect and do NOT reconnect
- Show a "Connection failed" message instead of endlessly retrying
- Only reconnect for sessions that were stable (lasted > 5 seconds), indicating a real network drop

**reconnectRef (line ~365)**:
- Add a cooldown check: if last reconnect attempt was less than 3 seconds ago, skip
- Increase the delay between retries to prevent hammering ElevenLabs

**Context sending (line ~475)**:
- Add a 2-second delay after `waitForConnection` before sending context, giving the WebRTC session time to stabilize

### Summary of changes

```text
File: src/pages/VizzyPage.tsx
- Add lastConnectTimeRef to track when connection was established
- Add lastReconnectTimeRef to enforce cooldown
- onDisconnect: skip reconnect if session lasted < 5 seconds
- reconnectRef: enforce 3s cooldown between attempts  
- Context sending: add 2s stabilization delay after connection confirmed
```
