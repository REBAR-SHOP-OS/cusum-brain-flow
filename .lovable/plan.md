

# Full Duplex Voice Chat (Barge-In + Continuous Listening)

## What Changes

Upgrade the voice chat from sequential half-duplex (Listen -> Think -> Speak -> Listen) to a **full duplex** experience where the microphone stays active even while the AI is speaking, enabling natural "barge-in" interruption -- just like ChatGPT's voice mode.

## Current Behavior

1. User taps orb -> mic starts
2. Silence detected -> mic stops, message sent
3. AI responds -> TTS plays
4. TTS finishes -> mic restarts

The user **cannot** interrupt by speaking -- they must tap the orb to interrupt.

## New Behavior

1. User taps orb -> mic starts
2. Silence detected -> message sent, **mic stays active**
3. AI responds -> TTS plays **while mic listens**
4. User speaks during TTS -> audio stops immediately, new transcript captured (barge-in)
5. TTS finishes naturally -> mic continues listening seamlessly

The conversation flows naturally without manual interruption.

## Technical Changes

### 1. `src/hooks/useVoiceChat.ts` -- Enable concurrent STT + TTS

- **Keep mic running during "speaking" state**: Instead of stopping speech recognition before TTS and restarting after, keep it running throughout. The browser's echo cancellation handles feedback prevention.
- **Barge-in detection**: When a final speech result arrives during the "speaking" state, immediately stop TTS audio, cancel any pending AI stream, and send the new user message.
- **Remove hard state gates**: The `handleSilenceEnd` callback currently requires `status === "listening"` -- relax this to also allow sending during "speaking" (which triggers barge-in) and "thinking" (which cancels the current response).
- **Simplify state transitions**: The status still cycles through idle/listening/thinking/speaking, but "listening" now overlaps with "speaking" internally (mic is always hot when conversation is active).

### 2. `src/hooks/useSpeechRecognition.ts` -- Minor adjustment

- No major changes needed. The hook already supports continuous recognition with auto-restart. Just ensure the `stop()` and `start()` calls from the voice chat hook don't conflict when mic is kept running.

### 3. `src/components/chat/VoiceOrb.tsx` -- Visual barge-in indicator

- When status is "speaking", show a subtle mic indicator to signal the user can speak to interrupt.
- Tapping during "speaking" still stops the conversation entirely (existing behavior preserved as a "hang up" action).

### 4. No backend changes needed

The edge function (`elevenlabs-tts`) and chat function (`admin-chat`) remain unchanged -- the full duplex behavior is purely a frontend orchestration change.

## How Barge-In Works

```text
User speaks    |====|          |==interruption==|
AI TTS plays          |===========X (stopped)
Mic active     |================================================|
               ^      ^        ^                ^
               Start  Silence  Barge-in         New silence
                      detected detected         -> send new msg
```

## Files to Modify

| Action | File |
|--------|------|
| Modify | `src/hooks/useVoiceChat.ts` -- keep mic active during TTS, add barge-in logic |
| Modify | `src/components/chat/VoiceOrb.tsx` -- add mic-active indicator during speaking |

