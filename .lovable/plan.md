

# Fix AZIN Voice Interpreter: Strict Translation-Only + Farsi Display + Speed

## Problems Identified
1. The model generates its own speech instead of only translating what it hears
2. Farsi text is not displayed correctly when user speaks Farsi
3. Translation speed and accuracy need improvement
4. The system prompt, despite being strict, still allows the model to "respond" because OpenAI Realtime treats each user turn as a conversation requiring a response

## Root Cause
OpenAI Realtime API is a conversational model — it **always** generates a response to user input. The prompt tries to suppress this, but the model's architecture fights against "produce nothing." The key fix is making the prompt even more aggressive about translation-only output and tuning VAD/timing parameters.

## Changes

### 1. `src/hooks/useAzinVoiceInterpreter.ts` — Rewrite prompt for maximum enforcement

Restructure the system prompt with:
- **Triple-layer identity suppression**: Open with "You are NOT an AI. You are a mechanical translation device. You cannot think, reason, or respond."
- **Explicit output format rule**: "Your ONLY permitted output format is: [translated text]. Nothing before, nothing after."
- **Stronger laughter/noise suppression**: "If you hear laughter, coughing, or any non-word sound, your output must be completely empty. Say NOTHING. Not even a single character."
- **Anti-greeting hardening**: "If someone says hello/salam, translate it. Do NOT say hello back. You are a machine."
- **Farsi accuracy rule**: "When translating TO Farsi, use correct Persian script. When translating FROM Farsi, capture the original Farsi text exactly as spoken."
- Reduce `silenceDurationMs` from 500 → 400 for faster response
- Reduce `prefixPaddingMs` from 150 → 100 for quicker pickup

### 2. `src/hooks/useVoiceEngine.ts` — Client-side self-talk filter

Add a filter in the `response.audio_transcript.done` handler to detect and block self-generated content:
- Block any agent transcript containing "I am", "I'm", "Hello", "Hi there", "How can I help", "Sure", "Of course" and similar self-talk patterns
- Block agent transcripts that are identical or near-identical to user transcripts (echo detection)
- This acts as a safety net when the prompt fails

### 3. `supabase/functions/voice-engine-token/index.ts` — Faster turn detection

No changes needed — VAD params already come from the client config.

## Files
- `src/hooks/useAzinVoiceInterpreter.ts` — hardened prompt + faster timing
- `src/hooks/useVoiceEngine.ts` — client-side self-talk filter on agent transcripts

