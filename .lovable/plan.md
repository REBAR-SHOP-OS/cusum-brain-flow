

## Fix Synology NAS Connection via QuickConnect Resolution

### Problem
The edge function gets an HTML page instead of JSON when connecting to the NAS. QuickConnect URLs (`quickconnect.to/RSI1`) use Synology's relay servers and require a resolution step before API calls can be made. Direct DDNS (`RSIC.synology.me:5001`) may also fail due to SSL certificate issues from external servers.

### Solution
Update the edge function to resolve the QuickConnect ID to the actual server URL using Synology's undocumented `global.quickconnect.to/Serv.php` API, then use the resolved URL for all API calls.

### Changes

**File**: `supabase/functions/synology-proxy/index.ts`

1. Add a `resolveQuickConnect(id)` function that:
   - POSTs to `https://global.quickconnect.to/Serv.php` with `{"command":"get_server_info","id":"RSI1","version":1}`
   - Extracts the external IP/port or relay URL from the response
   - Tries connecting via: direct external IP → DDNS hostname → relay tunnel (in order)

2. Update `getSid()` to:
   - If `SYNOLOGY_URL` looks like a QuickConnect ID (no `://`), resolve it first
   - If direct URL fails with HTML response, try QuickConnect resolution as fallback
   - Log resolved URL for debugging

3. Update the `SYNOLOGY_URL` secret to just `RSI1` (the QuickConnect ID) — simpler for the user

### QuickConnect Resolution Flow
```text
POST https://global.quickconnect.to/Serv.php
Body: {"command":"get_server_info","id":"RSI1","version":1}

Response includes:
  - server.external.ip + port
  - server.ddns (e.g. RSIC.synology.me)
  - env.relay_region

Try in order:
  1. https://{external_ip}:{port}
  2. https://{ddns}:{port}
  3. https://{id}.{relay_region}.quickconnect.to:{port}
```

### Files Changed

| File | Change |
|---|---|
| `supabase/functions/synology-proxy/index.ts` | Add QuickConnect ID resolution, fallback URL logic |

