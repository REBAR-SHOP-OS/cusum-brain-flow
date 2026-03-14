

# Fix: Private IP Camera Connection Test Timeout

## Problem
When testing a camera on a private IP (e.g. `10.0.0.139`):
1. Browser ping fails (cloud-hosted preview cannot reach LAN)
2. No local agent configured → skipped
3. Falls through to cloud edge function `camera-ping` → times out after 30s because cloud can't reach private IPs either

## Fix
In `src/components/camera/CameraManager.tsx`, add a guard after the agent check: if the IP is private and no agent succeeded, **skip the cloud edge function entirely** and immediately return an actionable error message telling the user to configure the Local Agent.

### Change (lines 403-409)
```typescript
// After agent block, before cloud edge function call:
if (privateIp) {
  setResult(false, null, "browser", undefined, 
    "Private IP — configure a Local Agent to test LAN cameras");
  return;
}
```

This eliminates the 30-second timeout entirely for private IPs and gives the user clear guidance.

### Additionally: Auto-add remaining Reolink cameras
Since the user wants all cameras added, I'll query the existing camera in the DB, then insert the remaining Reolink cameras on the same subnet using the same credentials pattern. I'll need the user to confirm the other camera IPs/names/zones — or I can look at the Reolink network to discover them. Let me check what info we have.

**Single file change**: `src/components/camera/CameraManager.tsx` — add private IP guard before cloud fallback.

