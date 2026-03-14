

# Quick-Add Reolink Cameras via Subnet Scan

## Approach
Since all your Reolink cameras share the same subnet (`10.0.0.x`) and likely the same credentials, we'll add a **"Bulk Add"** button that:

1. Pre-fills credentials from your existing camera (username `ERP`, same password pattern)
2. Lets you enter multiple IPs (e.g. `10.0.0.140, 10.0.0.141, 10.0.0.142`) or a range (`10.0.0.140-145`)
3. Auto-generates camera IDs and names from the IP
4. Lets you assign zones per camera in a simple list
5. Inserts all cameras in one batch

## UI
A new "Bulk Add" button next to the existing "Add Camera" button opens a dialog:
- **Credentials section** (pre-filled from existing camera): username, password, RTSP paths, ports
- **IP list**: textarea where you type IPs separated by commas or newlines, or a range like `140-145` (auto-prepends `10.0.0.`)
- **Per-camera table**: after parsing IPs, shows a mini table with Name (editable), IP, Zone dropdown for each
- **"Add All" button**: bulk inserts

## Changes
- **Modify**: `src/components/camera/CameraManager.tsx` — add Bulk Add button + dialog with IP range parsing and batch insert logic

