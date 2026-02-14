

# Fix Vizzy Voice "Connection Lost" — Use Signed URL Fallback

## Problem

The ElevenLabs conversation token works (200 OK), but the WebRTC agent connects and disconnects within 1-2 seconds. The 404 on `/rtc/v1/validate` indicates a LiveKit protocol version mismatch between the SDK and the ElevenLabs server. The agent participant joins the room but leaves almost immediately.

## Root Cause

The `@elevenlabs/react` SDK v0.14.0 uses a newer LiveKit protocol version that ElevenLabs' server doesn't fully support yet (the `/rtc/v1/validate` 404 error). While the initial WebSocket fallback connects, the agent-side participant terminates the session quickly.

## Solution

### 1. Switch to Signed URL connection (`src/pages/VizzyPage.tsx`)

Instead of `conversationToken` (which routes through LiveKit WebRTC), use `signedUrl` with `connectionType: "websocket"`. This avoids the LiveKit `/rtc/v1` path entirely and uses a direct WebSocket connection which is more stable.

### 2. Update Edge Function to provide signed URL (`supabase/functions/elevenlabs-conversation-token/index.ts`)

Fetch a signed URL from ElevenLabs' `/get-signed-url` endpoint instead of (or in addition to) the conversation token. The signed URL uses a different connection path that bypasses the LiveKit version issue.

### 3. Fallback chain in VizzyPage

Try WebRTC with conversation token first. If the session fails within 5 seconds (our existing guard catches this), the "Tap to reconnect" button will use WebSocket + signed URL as fallback.

## Technical Details

### Edge Function Changes (`elevenlabs-conversation-token/index.ts`)

Add a second fetch to get the signed URL:

```text
GET https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id={agentId}
```

Return both `token` (for WebRTC) and `signed_url` (for WebSocket fallback).

### VizzyPage Changes (`src/pages/VizzyPage.tsx`)

- Store both token and signed_url from the edge function response
- Initial connection: try `conversationToken` + `webrtc` first
- If session fails < 5 seconds (existing guard): set a `useWebSocketFallback` flag
- "Tap to reconnect" / `manualReconnect`: if fallback flag is set, use `signedUrl` + `websocket`
- Reconnect function: use WebSocket mode when fallback is active

### Files Changed
1. `supabase/functions/elevenlabs-conversation-token/index.ts` — add signed URL fetch
2. `src/pages/VizzyPage.tsx` — WebSocket fallback logic

