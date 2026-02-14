

# Live Conversational Voice Chat (Gemini/GPT Style)

## Problem

The current voice mode requires manual taps for every turn: tap to listen, tap to send, wait for response, tap again. Real conversational AI (like Gemini Live or ChatGPT Voice) flows automatically in a continuous loop.

## Solution

Transform voice mode into a **continuous conversation loop** that auto-cycles through: listen -> send -> think -> speak -> listen again -- hands-free after the first tap.

```text
Current Flow (tap-heavy):
  [tap] -> listen -> [tap] -> send -> think -> speak -> idle -> [tap] -> ...

New Flow (conversational):
  [tap] -> listen -> (silence detected) -> auto-send -> think -> speak -> auto-listen -> ...
  [tap anytime] -> interrupt / stop
```

## Changes

### 1. `src/hooks/useSpeechRecognition.ts`
- Add an `onSilenceEnd` callback option that fires when the browser's speech recognition detects a final result followed by a pause
- Add an `autoStopOnSilence` option with a configurable timeout (e.g., 1.5s after last final result)
- This replaces the need for the user to manually tap "stop"

### 2. `src/hooks/useVoiceChat.ts` -- core loop changes
- **Auto-send on silence**: When speech recognition detects end-of-speech (silence), automatically send the transcript instead of waiting for a tap
- **Auto-listen after speaking**: When TTS audio finishes playing (`audio.onended`), automatically restart speech recognition instead of going to "idle"
- Add a new `"conversational"` mode flag so the loop continues until the user explicitly taps to stop
- Single tap on orb during any state = **stop conversation entirely** (go to idle)
- During "speaking" state, tap = interrupt and start listening (already works)

### 3. `src/components/chat/VoiceOrb.tsx`
- Update status labels for conversational context:
  - idle: "Tap to start conversation"
  - listening: "Listening..."
  - thinking: "Thinking..."
  - speaking: "Speaking... tap to interrupt"
- Add a subtle "End" button or change orb to show a stop icon when conversation is active

### 4. `src/pages/LiveChat.tsx`
- In voice mode, hide the text input area for a cleaner, immersive experience
- Show a minimal transcript of what was heard (already partially there with `interimText`)
- Show a "conversation active" indicator

## Technical Details

### Auto-send via silence detection
```typescript
// In useSpeechRecognition: fire callback after 1.5s of silence following a final result
const silenceTimer = useRef<NodeJS.Timeout>();
recognition.onresult = (event) => {
  // ... existing logic ...
  if (result.isFinal) {
    clearTimeout(silenceTimer.current);
    silenceTimer.current = setTimeout(() => {
      options?.onSilenceEnd?.();
    }, 1500);
  }
};
```

### Auto-listen after TTS ends
```typescript
// In useVoiceChat triggerTTS:
audio.onended = () => {
  URL.revokeObjectURL(url);
  audioRef.current = null;
  // Instead of setStatus("idle"), restart listening:
  speech.reset();
  ttsTriggeredRef.current = false;
  speech.start();
  setStatus("listening");
};
```

### Conversation lifecycle
```text
handleOrbTap():
  idle -> start listening (begin conversation)
  listening -> stop conversation (go to idle)
  thinking -> cancel + go to idle
  speaking -> interrupt, start listening immediately

onSilenceEnd():
  listening -> auto-send transcript -> thinking

audio.onended():
  speaking -> auto-restart listening
```

| Action | File |
|--------|------|
| Modify | `src/hooks/useSpeechRecognition.ts` -- add silence detection callback |
| Modify | `src/hooks/useVoiceChat.ts` -- implement auto-loop (auto-send, auto-listen) |
| Modify | `src/components/chat/VoiceOrb.tsx` -- update labels and add stop indicator |
| Modify | `src/pages/LiveChat.tsx` -- hide text input in voice mode, cleaner UX |

