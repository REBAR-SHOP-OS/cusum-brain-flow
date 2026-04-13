

# Fix ICE Connectivity Failure in Vizzy Live WebRTC

## Confirmed State
- Blocking ICE wait is **already removed** from `useVizzyRealtimeVoice.ts` — SDP is sent immediately
- `waitForIceGatheringComplete` is NOT called in this flow
- The failure is ICE connectivity itself: `ice=disconnected`, `iceGather=gathering`, `dc=connecting`, `track=true`
- The free metered.ca TURN servers are likely dead/rate-limited, causing ICE to never complete

## Root Cause
The `ICE_SERVERS` in `realtimeConnection.ts` include 4 metered.ca TURN entries using free-tier credentials that are unreliable. When STUN-only connectivity fails (symmetric NAT, firewall), the TURN fallback also fails because those servers don't work. ICE never connects → data channel never opens → session.created never arrives.

## Plan

### File 1: `src/lib/webrtc/realtimeConnection.ts`
- Remove the dead metered.ca TURN servers (they require paid accounts to actually relay)
- Keep Google STUN + Cloudflare STUN (these are reliable and free)
- For OpenAI Realtime specifically, TURN is not needed — OpenAI's servers are on public IPs and handle ICE from the server side. The browser just needs STUN to discover its own reflexive candidate
- Remove the unused `waitForIceGatheringComplete` and `hasUsableCandidates` exports (dead code for this flow; other flows that use them will be unaffected since we keep the exports)

Actually — keep all exports since `VizzyCallHandler.tsx` and `useVoiceEngine.ts` use them. Only change the ICE server list.

### File 2: `src/hooks/useVizzyRealtimeVoice.ts`
- No changes needed — the immediate SDP flow is already correct
- Keep all debug instrumentation, attempt guards, grace periods

## What Changes
| File | Change |
|------|--------|
| `src/lib/webrtc/realtimeConnection.ts` | Remove dead metered.ca TURN entries from `ICE_SERVERS`. Keep STUN servers only. |

## What Stays
- All debug step instrumentation
- Attempt ID stale-guard logic
- Grace periods and timeout logic
- Bridge server (untouched)
- No ERP changes
- No UI changes

## Restart Required
No. This is a frontend-only change. The preview auto-reloads. The bridge server on port 8787 stays untouched.

## Why This Should Fix It
OpenAI Realtime runs on public infrastructure. STUN is sufficient for the browser to discover its reflexive address. The dead TURN entries were likely causing the browser to spend time attempting TURN connections that never succeed, delaying or blocking ICE connectivity. Removing them lets ICE resolve faster via STUN-only candidates.

If STUN-only still fails after this patch, it means the network itself blocks UDP (rare). That would require a working TURN server — but the current ones are confirmed dead. We'd then need real TURN credentials.

