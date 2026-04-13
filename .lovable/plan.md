

## Fix: Dynamic TURN Credentials for Vizzy Voice WebRTC

### Problem
Hardcoded Metered TURN credentials in `src/lib/webrtc/realtimeConnection.ts` are expired/rate-limited, causing ICE failures (`ice=failed`, `dcOpen=false`) especially on mobile.

### Changes

**1. Add secret: `METERED_TURN_API_KEY`**
- Use the `add_secret` tool to request the Metered API key from the user
- This stays server-side only — never exposed to frontend

**2. `supabase/functions/voice-engine-token/index.ts`**
- Read `METERED_TURN_API_KEY` from env
- Fetch fresh TURN credentials from `https://rebar-shop.metered.live/api/v1/turn/credentials?apiKey=...`
- Return `turn_servers` array in the response alongside `client_secret`
- If Metered API fails, return empty `turn_servers` (graceful degradation)

**3. `src/lib/webrtc/realtimeConnection.ts`**
- Update `createRealtimePeerConnection(turnServers?: RTCIceServer[])` to accept dynamic servers
- Remove hardcoded Metered username/credential
- Keep fallback STUN: `stun:stun.l.google.com:19302`, `stun:stun.cloudflare.com:3478`
- If `turnServers` provided, merge with STUN; otherwise STUN-only

**4. `src/hooks/useVizzyRealtimeVoice.ts`**
- Parse `turn_servers` from token response
- Pass into `createRealtimePeerConnection(turnServers)`
- On ICE failure (before session usable): retry once with `iceTransportPolicy: "relay"` using same turn servers

### Safety
- No ERP/UI changes
- No frontend-exposed secrets
- Existing diagnostics preserved
- Graceful fallback if Metered API unreachable

### Execution Order
1. Request `METERED_TURN_API_KEY` secret from user
2. Wait for confirmation
3. Update edge function → deploy
4. Update `realtimeConnection.ts`
5. Update `useVizzyRealtimeVoice.ts` with dynamic TURN + relay retry

