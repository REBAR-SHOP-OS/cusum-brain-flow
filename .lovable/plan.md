

# Fix Vizzy Voice Chat — Can't Hear or Be Heard

## Root Cause

The console logs show repeated errors:
- "Initial connection failed: v1 RTC path not found. Consider upgrading your LiveKit server version"
- WebSocket connections closing with code 1006 (abnormal closure)

The ElevenLabs React SDK v0.14.0 uses LiveKit internally for WebRTC, but the LiveKit protocol negotiation is failing. The connection never establishes, so audio never flows in either direction.

## Fix

Switch from WebRTC to **WebSocket** connection using a **signed URL** instead of a conversation token. WebSocket connections are more compatible and bypass the LiveKit RTC path issue entirely.

### Changes

**1. Update Edge Function: `supabase/functions/elevenlabs-conversation-token/index.ts`**
- Rename to serve both token types, but primarily return a `signed_url` for WebSocket
- Change API call from `/v1/convai/conversation/token` to `/v1/convai/conversation/get-signed-url`
- Return `{ signed_url }` instead of `{ token }`

**2. Update Hook: `src/hooks/useVizzyVoice.ts`**
- Change `startSession` to use `signedUrl` + `connectionType: "websocket"` instead of `conversationToken` + `connectionType: "webrtc"`
- Add `onStatusChange` callback to better track connection state
- Add a connection timeout (15 seconds) so users aren't stuck on "Connecting..." forever

**3. Update Voice UI: `src/components/vizzy/VizzyVoiceChat.tsx`**
- No major changes needed — the UI already handles all states correctly
- Add a small "connection timeout" message if stuck connecting for too long

### Technical Details

Edge function change:
```typescript
// Before
const response = await fetch(
  `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${ELEVENLABS_AGENT_ID}`,
  { headers: { "xi-api-key": ELEVENLABS_API_KEY } }
);
const { token } = await response.json();
return json({ token });

// After
const response = await fetch(
  `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${ELEVENLABS_AGENT_ID}`,
  { headers: { "xi-api-key": ELEVENLABS_API_KEY } }
);
const { signed_url } = await response.json();
return json({ signed_url });
```

Hook change:
```typescript
// Before
await conversation.startSession({
  conversationToken: data.token,
  connectionType: "webrtc",
});

// After
await conversation.startSession({
  signedUrl: data.signed_url,
  connectionType: "websocket",
});
```

### Why WebSocket over WebRTC?

- WebRTC requires LiveKit server protocol compatibility — the current SDK version expects a newer protocol that the ElevenLabs infrastructure may not be serving for this agent configuration
- WebSocket is the original and most battle-tested connection method for ElevenLabs Conversational AI
- Audio quality is still excellent over WebSocket — the difference is negligible for voice chat
- WebSocket connections are simpler and don't need STUN/TURN negotiation

