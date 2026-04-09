

# Fix Vizzy Voice: Persian Language Support & Silence on Unclear Input

## Problems
1. **Persian not recognized**: Browser SpeechRecognition defaults to `en-US` when no `lang` is set. Persian speech gets mangled into English gibberish, then sent to Gemini which responds to nonsense.
2. **Responds to unclear input**: Even garbled/misrecognized text triggers a full Gemini response + TTS, creating noise.

## Solution

### 1. Add Language Toggle (EN / FA) to Vizzy Voice UI
Add a small toggle button in `VizzyVoiceChat.tsx` so the user can switch STT language between English and Farsi. When switched, the SpeechRecognition restarts with the correct `lang` (`en-US` or `fa-IR`).

### 2. Pass Language Through the Chain
- **`useVizzyGeminiVoice.ts`**: Accept a `lang` parameter, pass it to `useSpeechRecognition({ lang })`. When lang changes, restart recognition with new language.
- **`useVizzyVoiceEngine.ts`**: Expose `lang` / `setLang` and forward to the Gemini voice hook.

### 3. Silent Handling of Unclear Input
- **System prompt** (in `useVizzyVoiceEngine.ts`): Add instruction: "If the transcribed input is clearly garbled, nonsensical, or you cannot understand the user's intent, respond with exactly `[UNCLEAR]` and nothing else."
- **`useVizzyGeminiVoice.ts` → `processOneInput`**: After getting Gemini's response, if `fullResponse.trim() === "[UNCLEAR]"`, skip adding the agent transcript and skip TTS entirely. Also remove the user transcript that was just added (since it was noise). This means the UI stays clean — no bubble appears for unclear input.

## Technical Changes

### File: `src/hooks/useSpeechRecognition.ts`
- No changes needed — already supports `lang` option.

### File: `src/hooks/useVizzyGeminiVoice.ts`
- Add `lang` to the options interface
- Pass `lang` to `useSpeechRecognition({ lang, silenceTimeout: 2000, ... })`
- In `processOneInput`: after getting `fullResponse`, check if it's `[UNCLEAR]` → if so, remove the user transcript entry and return without adding agent transcript or calling TTS
- Handle `lang` changes by restarting recognition

### File: `src/hooks/useVizzyVoiceEngine.ts`
- Add `lang` / `setLang` state
- Pass `lang` to `useVizzyGeminiVoice`
- Expose `lang` and `setLang` in the return object
- Add to system prompt (BACKGROUND NOISE section): "If the input is garbled or you cannot determine user intent, respond with exactly `[UNCLEAR]` — no other text."

### File: `src/components/vizzy/VizzyVoiceChat.tsx`
- Add a small EN/FA toggle near the mic/mute button
- Wire it to `setLang` from the engine
- Visual indicator showing current language

