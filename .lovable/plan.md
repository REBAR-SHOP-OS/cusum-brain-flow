

# Fix Vizzy Connection Stability -- Switch to WebRTC

## Root Cause

The ElevenLabs connection keeps dropping because:

1. **WebSocket mode is being used** -- The current code uses `connectionType: "websocket"` with a `signed_url`. WebSocket connections are inherently less stable and more prone to disconnections.
2. **ElevenLabs recommends WebRTC** -- Their docs explicitly state WebRTC has "lower latency, better audio quality" and is the recommended connection type.
3. **Wrong API endpoint** -- The edge function calls `get-signed-url` (for WebSocket) instead of the `token` endpoint (for WebRTC).

## The Fix

Switch the entire pipeline from WebSocket to WebRTC. This is a straightforward swap.

### 1. Update Edge Function: `supabase/functions/elevenlabs-conversation-token/index.ts`

Change the ElevenLabs API call from:
```
GET /v1/convai/conversation/get-signed-url?agent_id=...
```
to:
```
GET /v1/convai/conversation/token?agent_id=...
```

Return `token` instead of `signed_url` in the response (also keep `signed_url` for backward compatibility).

### 2. Update Client: `src/pages/VizzyPage.tsx`

- Change `conversation.startSession({ signedUrl: ..., connectionType: "websocket" })` to `conversation.startSession({ conversationToken: ..., connectionType: "webrtc" })`
- Update the reconnect logic to use the same WebRTC approach
- Reduce `MAX_RETRIES` back to 3 since WebRTC is much more stable -- fewer retries needed

### 3. No Other Changes Needed

- Same auth flow, same context loading, same client tools
- Farsi mode is unaffected (uses browser APIs, not ElevenLabs)

## Technical Details

### Edge Function Change

```text
// Before
fetch(`https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`)
// Returns: { signed_url: "wss://..." }

// After  
fetch(`https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${agentId}`)
// Returns: { token: "eyJ..." }
```

### Client Change

```text
// Before
await conversation.startSession({ signedUrl: data.signed_url, connectionType: "websocket" });

// After
await conversation.startSession({ conversationToken: data.token, connectionType: "webrtc" });
```

### Why WebRTC is More Stable

- WebRTC uses UDP-based media transport with automatic quality adaptation
- Built-in ICE (connectivity establishment) handles network changes gracefully
- Automatic echo cancellation and noise suppression at the transport level
- No TCP head-of-line blocking that causes WebSocket audio stuttering
- Browser-native reconnection handling

### Files to Modify

1. `supabase/functions/elevenlabs-conversation-token/index.ts` -- Switch API endpoint from signed-url to token
2. `src/pages/VizzyPage.tsx` -- Switch from WebSocket to WebRTC connection type

