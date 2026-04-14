

## Plan: Update Secrets to Tailscale Funnel Public URLs

### Problem
Edge functions run in Deno Deploy (cloud) and cannot reach private Tailscale IPs (`100.86.84.110`). Tailscale Funnel exposes services via public HTTPS hostnames.

### Changes

1. **Update secret `BACKEND_URL`** — from `http://100.86.84.110:3000` → `https://pc.tail669f65.ts.net`
2. **Update secret `TTS_API_URL`** — from `http://100.86.84.110:9009` → `https://pc.tail669f65.ts.net:9009`
3. **Redeploy edge functions** — `personaplex-voice`, `vizzy-voice-chat`, `vizzy-tts` to pick up new secrets
4. **Health check** — curl all three endpoints to verify connectivity

### Prerequisites
You must have Tailscale Funnel active on the PC node before we update:
```powershell
tailscale funnel localhost:3000
tailscale funnel localhost:9009
```

### What does NOT change
- Edge function code — already reads from `BACKEND_URL` and `TTS_API_URL` env vars
- Frontend code — unchanged
- No database changes

