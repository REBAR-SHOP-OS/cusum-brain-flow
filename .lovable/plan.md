

# Replace ElevenLabs TTS with Browser Speech Synthesis

## Problem

ElevenLabs quota is exhausted (0 credits remaining). The voice chat loop breaks because TTS always returns 502.

## Solution

Replace the ElevenLabs API call in `useVoiceChat.ts` with the browser's built-in `window.speechSynthesis` (Web Speech API). This is completely free, requires no API keys, and works in Chrome, Edge, Safari, and Firefox.

Gemini models available through the Lovable AI gateway only support text chat completions -- they do not have a TTS endpoint. The browser's built-in speech synthesis is the most reliable zero-cost option.

## Changes

### `src/hooks/useVoiceChat.ts`

1. Remove the `TTS_URL` constant and the `fetch` call to `elevenlabs-tts`
2. Replace `triggerTTS` with a function that uses `window.speechSynthesis.speak(new SpeechSynthesisUtterance(text))`
3. Hook into `utterance.onend` to auto-restart listening (same as the current `audio.onended` logic)
4. Hook into `utterance.onerror` to handle failures gracefully
5. Update `stopAudio` to call `window.speechSynthesis.cancel()` instead of pausing an Audio element
6. Remove the Supabase auth session fetch (no longer needed for TTS)

### What stays the same

- The entire conversation loop (silence detection, auto-send, auto-listen)
- The `useSpeechRecognition` hook -- unchanged
- The `VoiceOrb` component -- unchanged
- The `LiveChat` page -- unchanged

## Technical Details

```text
Before (ElevenLabs):
  triggerTTS(text)
    -> fetch(elevenlabs-tts edge function)
    -> receive audio blob
    -> new Audio(blob).play()
    -> audio.onended -> restart listening

After (Browser SpeechSynthesis):
  triggerTTS(text)
    -> new SpeechSynthesisUtterance(text)
    -> speechSynthesis.speak(utterance)
    -> utterance.onend -> restart listening
```

Key implementation:

```typescript
const triggerTTS = useCallback((text: string) => {
  if (!window.speechSynthesis) {
    setStatus("idle");
    return;
  }
  window.speechSynthesis.cancel(); // clear any queue
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;

  utterance.onend = () => {
    if (conversationActiveRef.current) {
      speechRef.current.reset();
      ttsTriggeredRef.current = false;
      speechRef.current.start();
      setStatus("listening");
    } else {
      setStatus("idle");
    }
  };

  utterance.onerror = () => {
    setStatus("idle");
    conversationActiveRef.current = false;
  };

  setStatus("speaking");
  window.speechSynthesis.speak(utterance);
}, []);
```

| Action | File |
|--------|------|
| Modify | `src/hooks/useVoiceChat.ts` -- replace ElevenLabs fetch with speechSynthesis |
