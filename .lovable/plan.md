

## Plan: AZIN Real-Time Voice Interpreter

### What We're Building
Replace the current AZIN avatar button in the header with a smaller button next to the microphone orb at the bottom. When tapped, it opens a full-screen voice chat overlay (like the existing Vizzy voice chat) but with a dedicated interpreter agent that ONLY translates: Farsi heard → speaks English, English heard → speaks Farsi. Ultra-fast, no chitchat.

### Architecture

The existing Vizzy voice chat uses ElevenLabs Conversational AI with `ELEVENLABS_AGENT_ID`. For AZIN interpreter we need a **separate agent** dedicated to translation. Two options:

1. **New ElevenLabs Agent ID** — Create a new agent in ElevenLabs dashboard with interpreter-only prompt, store as `ELEVENLABS_AZIN_AGENT_ID` secret
2. **Override prompt at connection time** — Use the same agent but override the system prompt via `overrides` parameter (requires override to be enabled in ElevenLabs UI)

**Option 1 is more reliable** since overrides require ElevenLabs UI config. We will ask the user to provide `ELEVENLABS_AZIN_AGENT_ID`.

### Changes

**1. New edge function: `supabase/functions/elevenlabs-azin-token/index.ts`**
- Same as `elevenlabs-conversation-token` but uses `ELEVENLABS_AZIN_AGENT_ID`
- Returns signed URL for AZIN interpreter agent

**2. New hook: `src/hooks/useAzinVoiceInterpreter.ts`**
- Uses `useConversation` from `@elevenlabs/react`
- Calls `elevenlabs-azin-token` for signed URL
- Tracks transcripts (user + agent) for display
- Same audio-reactive pattern as `useVizzyVoice`

**3. New component: `src/components/azin/AzinInterpreterVoiceChat.tsx`**
- Full-screen overlay like `VizzyVoiceChat` but with AZIN branding
- Shows bilingual transcript (user speech + agent translation)
- Audio-reactive avatar orb
- Volume control + end call button

**4. Update `src/pages/AzinInterpreter.tsx`**
- Move AZIN avatar button from header to bottom bar, next to the mic orb
- On click → opens `AzinInterpreterVoiceChat` overlay
- Remove `AzinVoiceChatButton` from header

**5. Secret: `ELEVENLABS_AZIN_AGENT_ID`**
- Ask user to provide via `add_secret`
- The ElevenLabs agent should be configured with prompt: "You are a real-time interpreter. If the user speaks Farsi, respond with the English translation only. If the user speaks English, respond with the Farsi translation only. Never add explanations. Just translate. Be extremely fast."

### Files
1. `supabase/functions/elevenlabs-azin-token/index.ts` — new edge function
2. `src/hooks/useAzinVoiceInterpreter.ts` — new hook
3. `src/components/azin/AzinInterpreterVoiceChat.tsx` — new full-screen voice overlay
4. `src/pages/AzinInterpreter.tsx` — move button to bottom, wire up overlay

