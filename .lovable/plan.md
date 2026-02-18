
# Equip Vizzy with Full-Duplex Voice Chat (Siri-Like)

## What We're Building

A real-time, full-duplex voice conversation mode for Vizzy using ElevenLabs Conversational AI. When the user taps the mic button on the Vizzy avatar, instead of going to the text chat page, it opens a beautiful full-screen voice interface where Vizzy listens and responds like Siri -- naturally, with interruption support, and zero typing required.

## How It Works

1. User taps the mic icon on the floating Vizzy button
2. A full-screen voice overlay opens with a pulsing orb animation
3. The app requests microphone permission, fetches a conversation token from the backend, and connects via WebRTC
4. User speaks naturally -- Vizzy listens, thinks, and responds with a human-like voice in real-time
5. Full duplex: user can interrupt Vizzy mid-sentence, just like talking to a real person
6. Live captions show what the user said and what Vizzy is saying
7. Tap the X or say "goodbye" to end the session

## Architecture

```
User speaks --> Microphone --> WebRTC --> ElevenLabs Agent (cloud)
                                              |
                                    Processes speech, generates response
                                              |
ElevenLabs Agent --> WebRTC --> Speaker --> User hears Vizzy
```

The ElevenLabs Agent (configured externally with ELEVENLABS_AGENT_ID) handles the full pipeline: speech-to-text, AI reasoning, and text-to-speech -- all in real-time over a single WebRTC connection.

## Technical Details

### 1. Create Edge Function: `supabase/functions/elevenlabs-conversation-token/index.ts`
- Fetches a single-use WebRTC conversation token from ElevenLabs API using the stored `ELEVENLABS_API_KEY` and `ELEVENLABS_AGENT_ID` secrets
- Returns `{ token }` to the client
- Config entry already exists in `config.toml`

### 2. Create Voice Chat Component: `src/components/vizzy/VizzyVoiceChat.tsx`
- Full-screen overlay with dark glassmorphic background
- Animated pulsing orb that reacts to speaking state (user speaking vs Vizzy speaking vs idle)
- Uses `useConversation` hook from `@elevenlabs/react` for WebRTC connection
- Shows live captions: user transcript and agent response
- Close button + auto-disconnect on unmount
- Status indicators: "Connecting...", "Listening...", "Vizzy is speaking...", "Tap to end"
- Volume visualization using `getInputVolume()` / `getOutputVolume()`

### 3. Create Hook: `src/hooks/useVizzyVoice.ts`
- Wraps the ElevenLabs `useConversation` hook
- Manages connection lifecycle (token fetch, connect, disconnect)
- Tracks conversation state: idle, connecting, connected, error
- Stores transcript history for display
- Handles errors gracefully with toast notifications

### 4. Update `src/components/vizzy/FloatingVizzyButton.tsx`
- Change the mic button's `onMicClick` to open the voice overlay instead of navigating to `/chat?voice=1`
- Add state to toggle the `VizzyVoiceChat` overlay

### 5. Voice Chat UI Design
- **Idle/Listening**: Soft teal pulsing orb with "Listening..." label
- **Vizzy Speaking**: Brighter, faster pulse with "Vizzy is speaking..." label
- **Connecting**: Spinner with "Connecting to Vizzy..."
- **Error**: Red flash with retry button
- Vizzy's avatar displayed in center of the orb
- Transcript bubbles scroll up from bottom (last 3-4 exchanges visible)
- Single large "End Call" button at bottom

### Files to Create
1. `supabase/functions/elevenlabs-conversation-token/index.ts` -- Token endpoint
2. `src/hooks/useVizzyVoice.ts` -- Voice session management hook
3. `src/components/vizzy/VizzyVoiceChat.tsx` -- Full-screen voice UI

### Files to Modify
1. `src/components/vizzy/FloatingVizzyButton.tsx` -- Wire up mic to voice overlay
