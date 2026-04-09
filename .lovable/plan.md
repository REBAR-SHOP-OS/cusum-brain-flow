
# Remove Language Toggle, Enable Auto-Detect STT

## Problem
The EN/FA language toggle is unnecessary — the AI system prompt already instructs Vizzy to auto-detect and respond in the user's language. The real issue is that when `lang` is set to `"en-US"`, browser Speech Recognition cannot transcribe Farsi input correctly. Removing the toggle and not forcing a specific language lets the browser's STT engine auto-detect.

## Changes

### 1. `src/hooks/useVizzyVoiceEngine.ts`
- Remove the `lang` state and `setLang` from the hook
- Do not pass any `lang` to the underlying voice engine (let browser default handle auto-detect)

### 2. `src/hooks/useSpeechRecognition.ts`
- When no `lang` is provided, skip setting `recognition.lang` — the browser defaults to the system language and can handle multilingual input

### 3. `src/components/vizzy/VizzyVoiceChat.tsx`
- Remove `lang` and `setLang` from the destructured hook values
- Delete the entire language toggle UI block (lines 483-507)

## Result
- No toggle button visible
- Browser STT auto-detects the spoken language
- Vizzy responds in whatever language the user speaks (already in system prompt)
- Single-language and mixed-language conversations both work naturally
