

# Best Solution: Network Scan via Reolink HTTP API

## Research Findings

Reolink cameras all expose an HTTP API at `http://<ip>/cgi-bin/api.cgi`. The key endpoints:

- **Login**: POST `[{cmd:"Login", action:0, param:{User:{userName:"...", password:"..."}}}]` -- returns a token
- **GetDevInfo**: Returns model, name, firmware, serial, channels
- **GetChannelStatus** (NVR only): Lists all connected cameras with name, type, online status
- **GetLocalLink**: Returns IP, MAC, gateway info

There is NO broadcast/multicast discovery protocol. Reolink uses their proprietary P2P protocol for discovery in their own app, which is undocumented. The only reliable programmatic approach is **IP range scanning** with credential validation.

## Recommended Approach: "Auto-Discover" Subnet Scanner

Build an edge function that takes a subnet + credentials, scans an IP range, and for each IP tries to login via the Reolink HTTP API. If login succeeds, it calls `GetDevInfo` to pull the camera name, model, and serial -- then returns a list of discovered cameras ready to register.

### Architecture

```text
Browser UI                Edge Function               Camera (LAN)
─────────                 ─────────────               ────────────
[Scan 10.0.0.100-200] →  camera-discover  ──HTTP──→  /cgi-bin/api.cgi
                          (Login + GetDevInfo)         (each IP in range)
                     ←    [{ip, name, model, serial}]
```

**Problem**: Edge functions run in the cloud and cannot reach private IPs (10.x.x.x). This must run on the **Local Agent** (the FastAPI service in `camera-intelligence/`).

### Solution: Two-path discovery

1. **Local Agent path** (primary): Add a `/discover` endpoint to the FastAPI service that scans an IP range, attempts Reolink HTTP API login on each, and returns discovered cameras with device info.

2. **Bulk Add UI enhancement**: Update the existing Bulk Add dialog to include a "Scan Subnet" button that calls the Local Agent's discover endpoint. Discovered cameras auto-populate the table with real names/models from the device.

3. **Fallback (no agent)**: Keep the current manual IP entry in Bulk Add for users without the Local Agent running.

### Changes

1. **New file: `camera-intelligence/discover.py`**
   - FastAPI endpoint `POST /discover` accepting `{subnet: "10.0.0", start: 100, end: 200, username, password}`
   - For each IP, attempt HTTP POST to `/cgi-bin/api.cgi` with Login command (2s timeout)
   - On success, call GetDevInfo to get name/model/serial
   - Return array of discovered cameras

2. **Update `camera-intelligence/main.py`** (or router registration)
   - Register the new discover router

3. **Update `src/components/camera/BulkAddCameras.tsx`**
   - Add "Scan Subnet" button next to Parse
   - When clicked, calls the Local Agent `/discover` endpoint
   - Auto-populates the camera table with discovered devices (name from GetDevInfo, IP, auto-suggest zone based on camera name)
   - Shows scan progress (scanning X of Y IPs...)

4. **Update `src/components/camera/CameraManager.tsx`**
   - Pass the Local Agent URL to BulkAddCameras if configured

### Why This Is the Easiest Way

- No manual IP entry needed -- just click "Scan" and all Reolink cameras on the subnet are found automatically with their real names and models
- Uses the official Reolink HTTP API (same as their own app uses internally)
- Credentials are validated during scan, so you know they work before registering
- One-click "Add All" after review

