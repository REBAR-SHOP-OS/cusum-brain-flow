

# Dual Camera Ping: Browser-Side + Local Agent Relay

## Overview
Implement two fallback ping methods so cameras on private LANs can be verified:

1. **Browser-side ping** — for private IPs (10.x, 192.168.x, 172.16-31.x), attempt an HTTP fetch directly from the user's browser which has LAN access
2. **Local agent relay** — add a `/ping` endpoint to the FastAPI camera-intelligence service so the ERP can proxy connectivity checks through the on-premise agent

The existing cloud edge function remains as the third option for public IPs.

## Changes

### 1. Browser-side ping utility
**Create**: `src/lib/browserPing.ts`

- Helper function `isPrivateIp(ip: string): boolean` — detects RFC 1918 ranges
- `browserPing(ip: string, port?: number): Promise<PingResult>` — attempts `fetch("http://{ip}/", { mode: "no-cors", signal })` with a 5s timeout
- Returns `{ reachable: boolean, latency_ms: number, method: "browser" }`
- Note: `no-cors` mode means we detect reachability by whether the request completes vs times out (opaque response is still "reachable")

### 2. Local agent relay endpoint
**Modify**: `camera-intelligence/main.py` — mount new ping router

**Create**: `camera-intelligence/ping.py`
- `POST /ping` endpoint accepting `{ ip_address, port }`
- Attempts HTTP GET to camera IP (port 80) with 5s timeout
- Attempts TCP socket connect to RTSP port with 5s timeout
- Returns `{ reachable, http_reachable, rtsp_reachable, latency_ms }`

### 3. Update CameraManager ping logic
**Modify**: `src/components/camera/CameraManager.tsx`

Update `handleTestConnection` with a strategy cascade:
1. If IP is private → try browser-side ping first
2. If browser ping fails or inconclusive → try local agent relay (if configured)
3. Fall back to cloud edge function for public IPs

Add a small settings state for the local agent URL (stored in localStorage, e.g. `http://192.168.1.50:8000`), with a tiny config input in the card header.

### Files
- **Create**: `src/lib/browserPing.ts`
- **Create**: `camera-intelligence/ping.py`
- **Modify**: `camera-intelligence/main.py` (mount ping router)
- **Modify**: `src/components/camera/CameraManager.tsx` (ping strategy cascade + agent URL config)

