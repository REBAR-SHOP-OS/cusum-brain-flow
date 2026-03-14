

# Parse Full Camera Details from QR Code

## Problem
Currently the QR scanner only extracts the raw string as a UID. Reolink QR codes actually encode multiple fields — UID, username, password, and potentially IP/port info.

## Changes

### 1. Update QR Scanner to return raw text
**Modify**: `src/components/camera/QRCameraScanner.tsx`
- Return the full raw decoded string instead of assuming it's just a UID

### 2. Add QR parsing utility
**Create**: `src/lib/parseReolinkQr.ts`
- Parse common Reolink QR formats:
  - JSON object (`{"uid":"...","user":"...","password":"..."}`)
  - Key-value pairs (`uid=...&user=...&password=...`)
  - Delimited string (semicolons, newlines)
- Return a typed object with: `uid`, `username`, `password`, `ip_address`, `port`, `channel`
- Fall back to treating the whole string as a UID if no structure is detected

### 3. Update CameraManager handler
**Modify**: `src/components/camera/CameraManager.tsx`
- Use the parser in `handleQrScanned` to auto-fill all available fields (`camera_id`, `username`, `password`, `ip_address`, `port`, `name`)
- Show a richer toast listing which fields were extracted

### Files
- **Create**: `src/lib/parseReolinkQr.ts`
- **Modify**: `src/components/camera/QRCameraScanner.tsx` (minor — pass raw text)
- **Modify**: `src/components/camera/CameraManager.tsx` (use parser, fill all fields)

