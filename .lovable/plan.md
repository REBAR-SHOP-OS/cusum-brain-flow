

# End-to-End Voice Chat (Mic to STT to AI to TTS to Speaker)

## Overview

Build a ChatGPT-style voice chat mode into the existing `/chat` page. No new routes or pages -- just a voice orb toggle in the existing `LiveChat.tsx` that switches between text mode and voice mode.

## Architecture

```text
[Browser Mic] --> Web Speech API (STT) --> transcript text
                                              |
                                              v
                                    admin-chat edge function (AI, streaming)
                                              |
                                              v
                                    streamed text displayed in chat
                                              |
                                              v (after first ~300 chars)
                                    elevenlabs-tts edge function (TTS)
                                              |
                                              v
                                    [Browser Audio playback]
```

## What Gets Built

### 1. New edge function: `elevenlabs-tts`

A backend function that accepts text and returns ElevenLabs audio bytes (MP3). Keeps the API key server-side.

- Accepts `{ text, voiceId? }` as JSON body
- Calls ElevenLabs `/v1/text-to-speech/{voiceId}` with `eleven_turbo_v2_5` model (low latency)
- Returns raw `audio/mpeg` bytes
- Default voice: Roger (`CwhRBWXzGAHq8TQ4Fs17`) -- can be changed
- Uses existing `ELEVENLABS_API_KEY` secret (already configured)

### 2. New hook: `useVoiceChat`

Orchestrates the full voice loop: listen, send, stream AI text, speak response.

**State machine:**
- `idle` -- waiting for user
- `listening` -- mic active, live transcript showing
- `thinking` -- AI is generating response
- `speaking` -- TTS audio playing

**Flow:**
1. User taps voice orb -- state becomes `listening`
2. `useSpeechRecognition` captures live transcript
3. User taps again (or silence detected) -- state becomes `thinking`
4. Final transcript sent to `admin-chat` via existing `useAdminChat`
5. As AI text streams in, accumulate it
6. Once 300+ characters are collected (or stream ends), call `elevenlabs-tts` with the text
7. State becomes `speaking`, audio plays via `new Audio(blobUrl)`
8. Audio ends -- state returns to `idle`

**Interrupt:** User can tap orb while speaking to stop audio and start listening again.

### 3. New component: `VoiceOrb`

A circular animated button showing the current voice state:
- `idle`: teal ring, mic icon
- `listening`: pulsing red ring, animated sound waves
- `thinking`: spinning loader
- `speaking`: pulsing teal ring, sound wave animation

### 4. Modified: `LiveChat.tsx`

Add a voice mode toggle:
- New "Voice Mode" button in the header (headset/mic icon)
- When active, shows the `VoiceOrb` centered above the chat input
- Voice responses are also added to the chat thread as text messages
- The text input area is still visible but the voice orb is the primary interaction
- Keyboard input still works in voice mode

### 5. Modified: `supabase/config.toml`

Add the new TTS function entry (auto-managed, but needs `verify_jwt = false`).

## Technical Details

### Edge Function: `elevenlabs-tts`

```text
File: supabase/functions/elevenlabs-tts/index.ts

- Auth: Validates bearer token (same pattern as admin-chat)
- Rate limit: 20 requests/minute via check_rate_limit
- Model: eleven_turbo_v2_5 (optimized for low latency)
- Output: audio/mpeg binary response
- Voice settings: stability 0.5, similarity_boost 0.75
```

### Hook: `useVoiceChat`

```text
File: src/hooks/useVoiceChat.ts

Dependencies:
- useSpeechRecognition (existing) -- for STT
- useAdminChat (existing) -- for AI chat
- supabase client -- for auth token

Key logic:
- Monitors useAdminChat messages to detect when streaming completes
- Collects assistant text chunks, triggers TTS at threshold
- Manages Audio object lifecycle (play, pause, cleanup)
- AbortController for canceling TTS fetch on interrupt
```

### Component: `VoiceOrb`

```text
File: src/components/chat/VoiceOrb.tsx

Props:
- status: 'idle' | 'listening' | 'thinking' | 'speaking'
- onTap: () => void
- disabled?: boolean

Visual:
- 64x64px circle with state-dependent animations
- Uses framer-motion for smooth transitions
- Tailwind classes for colors/rings
```

### Simultaneous Text + Voice Strategy

The "easy version" from the spec: collect AI text while streaming, trigger TTS once enough text is available (first sentence or ~300 chars). This creates the perception of simultaneous text and voice without complex audio chunking.

### Files Summary

| Action | File |
|--------|------|
| Create | `supabase/functions/elevenlabs-tts/index.ts` |
| Create | `src/hooks/useVoiceChat.ts` |
| Create | `src/components/chat/VoiceOrb.tsx` |
| Modify | `src/pages/LiveChat.tsx` -- add voice mode toggle and orb |

### What Is NOT Changing

- `useAdminChat` hook -- used as-is
- `useSpeechRecognition` hook -- used as-is
- `admin-chat` edge function -- used as-is
- `FloatingVizzyButton` -- untouched
- No new API keys needed (ELEVENLABS_API_KEY already exists)
