

## Fix Synology Connection: Use DDNS Instead of QuickConnect

### Problem
QuickConnect ID `RSI1` returns errno 9 (not found) from Synology's relay service. However, DDNS is working: `RSIC.synology.me` resolves to `99.229.81.177` with DSM on ports 5000 (HTTP) / 5001 (HTTPS).

### Fix

1. **Update `SYNOLOGY_URL` secret** to `https://RSIC.synology.me:5001` — this is a direct URL with port, so the edge function will skip QuickConnect resolution entirely and connect directly.

2. **Update edge function** to also try HTTP (port 5000) as fallback if HTTPS fails (self-signed cert from Synology can cause issues from server-side):
   - Try `https://RSIC.synology.me:5001` first
   - If that fails (SSL error), try `http://RSIC.synology.me:5000`

### Changes

| Item | Change |
|---|---|
| Secret `SYNOLOGY_URL` | Update to `https://RSIC.synology.me:5001` |
| `supabase/functions/synology-proxy/index.ts` | Add HTTP fallback in `getDsmBaseUrl` — if HTTPS connection fails, retry with HTTP on port 5000 |

### Technical Detail
The existing `getDsmBaseUrl` function already handles direct URLs (matching `^https?://.+:\d+`), so changing the secret to a full URL will bypass all QuickConnect resolution logic.

