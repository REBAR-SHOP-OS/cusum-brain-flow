

## Patch: Route voice through edge function proxy + add error feedback

### Problem
Browser-direct `fetch` to `https://pc.tail669f65.ts.net` fails silently (CORS / network). User sees their transcript but gets no assistant reply.

### Changes

**`src/hooks/useVizzyStreamVoice.ts`** — `callPersonaPlex` function (lines 91–186)

1. **Replace direct fetch with edge function proxy call**:
   - Remove the direct `fetch("https://pc.tail669f65.ts.net/...")` call
   - Import `supabase` from `@/integrations/supabase/client`
   - Get the current session's access token
   - Call `${VITE_SUPABASE_URL}/functions/v1/personaplex-voice` with auth headers
   - Send body: `{ messages: conversationRef.current, voiceEnabled: true }`
   - The edge function already proxies to the Vizzy One API with the correct request shape

2. **Add visible error feedback on failure**:
   - In the `catch` block (line 179), instead of just `console.error`, append an agent transcript entry:
     ```
     text: "⚠️ Vizzy API is unreachable right now. Please try again in a moment."
     ```
   - Also handle non-ok responses (lines 122–129) the same way — append an error transcript instead of silently returning
   - Set `apiConnected` to `false` on any failure
   - Set `errorDetail` with the actual error message for debugging

3. **Keep all debug state updates** (`apiConnected`, `intent`, `grounded`, `voicePath`, `audioStatus`) — map from the edge function's normalized response fields (`_api_connected`, `_intent`, `_grounded`, `_voice_path`, `_audio_status`)

### What stays unchanged
- Edge function `personaplex-voice/index.ts` — already proxies to the Vizzy One API correctly
- UI component `VizzyVoiceChat.tsx` — debug badges already display all metadata
- Audio playback, browser TTS fallback, STT, session management
- Read-only behavior, anti-fabrication guardrails

### Architecture after patch
```text
User speaks → Browser STT → personaplex-voice edge function
                                    ↓ (server-side proxy)
                          https://pc.tail669f65.ts.net/api/v1/vizzy/voice
                                    ↓
                          Response to client
                                    ↓
                     audio_base64? → play it
                     null?         → browser TTS (last resort)
                     error?        → show "API unreachable" in transcript
```

