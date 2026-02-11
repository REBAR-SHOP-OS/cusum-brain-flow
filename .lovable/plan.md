

## Fix: Switch Vizzy from WebRTC to WebSocket Connection

### Root Cause
Every connection attempt fails because `livekit.rtc.elevenlabs.io/rtc/v1/validate` returns **404**. This is the WebRTC validation endpoint. The WebSocket transport uses a different server path entirely and should work.

### What Changes

**1. Edge function: Switch from conversation token to signed URL**

The WebSocket connection uses a `signedUrl` instead of a `conversationToken`. The API endpoint is different:
- Current (WebRTC): `https://api.elevenlabs.io/v1/convai/conversation/token`
- New (WebSocket): `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url`

File: `supabase/functions/elevenlabs-conversation-token/index.ts`
- Change the ElevenLabs API call to use `get-signed-url` endpoint
- Return `signed_url` instead of `token`

**2. VoiceVizzy.tsx: Use signedUrl with websocket**

File: `src/components/vizzy/VoiceVizzy.tsx`
- Change `startSession` call to use `signedUrl` instead of `conversationToken`
- Change `connectionType` from `"webrtc"` to `"websocket"`
- Update the response field name from `data.token` to `data.signed_url`

**3. VizzyPage.tsx: Same change**

File: `src/pages/VizzyPage.tsx`
- Same `signedUrl` + `websocket` changes as VoiceVizzy

### Why This Should Work
WebSocket and WebRTC use completely different server infrastructure. The 404 is specific to the LiveKit RTC server. WebSocket connections go through a standard WebSocket endpoint that is not affected.

### Files Modified
- `supabase/functions/elevenlabs-conversation-token/index.ts`
- `src/components/vizzy/VoiceVizzy.tsx`
- `src/pages/VizzyPage.tsx`
