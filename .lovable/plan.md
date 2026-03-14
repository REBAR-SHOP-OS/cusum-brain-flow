

# Add Real Camera Connectivity Check

## Problem
The current Status column only reflects the manual `is_active` toggle — it never actually pings or probes the camera to confirm it's reachable.

## Solution
Add a "Test Connection" button per camera row and an edge function that attempts an HTTP connection to the camera's IP to verify reachability.

### 1. New Edge Function: `camera-ping`
- Accepts `{ ip_address, port, username, password }` 
- Attempts an HTTP GET to `http://{ip}:{http_port}/` (Reolink cameras respond on port 80 for HTTP)
- Also tries a basic TCP-level check on the RTSP port (554)
- Returns `{ reachable: boolean, latency_ms: number, error?: string }`
- Secured: requires authenticated user

### 2. UI Changes in `CameraManager.tsx`
- Add a "Test" button (signal icon) in the Actions column next to Edit/Delete
- On click, calls the edge function with the camera's connection details
- Shows a loading spinner while testing
- Updates the Status cell to show a green check (reachable) or red X (unreachable) with latency info
- Result shown via toast notification as well

### 3. Status Column Enhancement
- Replace the static Wifi icon with a dynamic status that can show: `untested` (gray), `online` (green), `offline` (red), `testing` (spinner)
- Store test results in component state (not persisted — it's a live check)

### Files
- **Create**: `supabase/functions/camera-ping/index.ts`
- **Modify**: `src/components/camera/CameraManager.tsx` — add Test button and dynamic status

