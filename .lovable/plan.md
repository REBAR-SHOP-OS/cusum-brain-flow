

# Vizzy Voice Chat — Complete Fresh Build

## Root Cause

Console logs show: session connects, then ElevenLabs server drops it after exactly ~500ms. Two technical issues:

1. **Duplicate microphone stream**: Code manually calls `getUserMedia` creating an unused stream, then the ElevenLabs SDK opens its own. This can cause conflicts.
2. **Wrong connection type**: Currently using WebSocket (`signedUrl`). ElevenLabs recommends WebRTC (`conversationToken`) for lower latency and better stability.
3. **Delayed context push**: The 3-second stabilization wait is longer than the session lifetime (500ms).

## Plan

### 1. `src/pages/VizzyPage.tsx` — Complete Rewrite (~250 lines)

Build from scratch with these fixes:

- **Remove manual `getUserMedia` call** — let the ElevenLabs SDK handle microphone access internally
- **Use WebRTC first** (`conversationToken: data.token`), fallback to WebSocket (`signedUrl`) only if WebRTC fails
- **Push context immediately in `onConnect` callback** instead of waiting 3 seconds
- **No auto-reconnection** — manual "Reconnect" button only
- **Multilingual support** — Farsi and English mandatory

Connection flow:
```text
1. Check admin role
2. Fetch token from edge function (returns both token + signed_url)
3. Try WebRTC connection (conversationToken)
4. If WebRTC fails -> try WebSocket (signedUrl)
5. On connect -> immediately load and push context
6. On disconnect -> show error + manual retry
```

### 2. `src/lib/vizzyContext.ts` — Update multilingual prompt

Add language detection rules to `buildVizzyContext`:
- Detect user's spoken language and respond in same language
- Farsi and English are mandatory languages
- Default language from user profile

### 3. Edge function — No changes needed

`elevenlabs-conversation-token` already returns both `token` and `signed_url`.

## Technical Details

Key differences from current code:

| Current | New |
|---------|-----|
| Manual `getUserMedia` + SDK mic (duplicate) | SDK handles mic only |
| WebSocket only (`signedUrl`) | WebRTC first (`conversationToken`), WebSocket fallback |
| 3s stabilization delay before context | Context pushed immediately in `onConnect` |
| Context push in `connect()` function | Context push in `onConnect` callback |
| `connectingRef` guard logic | Simpler state machine |

