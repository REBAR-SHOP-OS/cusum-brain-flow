

# Fix: Faithful Translation + No Interruption

## Problems (from screenshot)
1. **AI answers instead of translating**: "تو زیبا ترینی" (You are the most beautiful) → AI outputs "Thanks, you're very kind" (a RESPONSE, not a translation)
2. **Translation gets cut off**: When AZIN is reading a translation aloud and hears new audio, it stops mid-sentence instead of finishing

## Root Causes
1. Despite strong prompts, the model still interprets compliments/questions as conversational turns and generates responses. Need even more aggressive anti-response examples including this exact failing case.
2. OpenAI Realtime's `server_vad` interrupts the agent's speech when it detects user audio. The current `vadThreshold: 0.4` is too sensitive — background speech easily triggers interruption during translation playback.

## Changes

### 1. Voice Interpreter — prevent interruption (`useAzinVoiceInterpreter.ts`)
- Raise `vadThreshold` from `0.4` to `0.85` — much harder to interrupt while speaking
- Increase `silenceDurationMs` from `600` to `1000` — wait longer before concluding the user stopped talking
- Add explicit instruction: "ALWAYS complete the full translation. Never stop mid-sentence."
- Add the exact failing example to the prompt: `"تو زیبا ترینی" → "You are the most beautiful" NOT "Thanks, you're very kind"`

### 2. Text translation prompt (`translate-message/index.ts`)
- Add the specific failing example (compliment → must translate, not respond)
- Add rule: "Compliments, insults, statements directed at 'you' — translate them literally. They are NOT addressed to you."
- Lower Farsi minimum word threshold from 2 to 1 (some valid Farsi translations are single compound words)

### 3. Voice engine VAD config (`voice-engine-token/index.ts`)
- Accept an optional `interruptThreshold` parameter from the client
- When provided, use a higher VAD threshold to prevent premature interruption during agent speech

## Files to Edit
- `src/hooks/useAzinVoiceInterpreter.ts` — prompt + VAD settings
- `supabase/functions/translate-message/index.ts` — prompt examples
- `supabase/functions/voice-engine-token/index.ts` — accept higher VAD threshold

