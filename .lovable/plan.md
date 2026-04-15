

## Plan: Fix TTS SSL Issue — Update Secret + Edge Function Path

### Problem
The TTS proxy on port 9009 via Tailscale Funnel has an SSL cert validation issue. The proxy's endpoint path is `/tts`, but the edge function currently appends `/v1/tts` to the `TTS_API_URL` secret.

### Changes

1. **Update secret `TTS_API_URL`** → `https://pc.tail669f65.ts.net:9009`
   - Keep the base URL clean (no path suffix in the secret)

2. **Update `vizzy-tts/index.ts`** — change the endpoint path from `/v1/tts` to `/tts`
   - Line 31: `const endpoint = \`\${ttsUrl}/tts\`;`
   - This matches the proxy's actual route

3. **Redeploy `vizzy-tts`** and run a health check to confirm audio generation works end-to-end

### What does NOT change
- `personaplex-voice` and `vizzy-voice-chat` — already working via `BACKEND_URL`
- Frontend code — unchanged
- No database changes

