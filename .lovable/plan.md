

## Plan: Hardcode Metered TURN in buildIceServers()

**File:** `src/lib/webrtc/realtimeConnection.ts`

Replace the entire `buildIceServers()` function body and remove the `STUN_SERVERS` constant. The function will return a fixed array with one STUN and one TURN entry (4 URLs, hardcoded username/credential). All `import.meta.env.VITE_TURN_*` references and the env-var parsing logic will be removed.

No other files change. Expected result: console shows `relay > 0` after rebuild.

