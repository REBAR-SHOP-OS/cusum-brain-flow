

# Fix Voice Interpreter: Farsi Display, Self-Talk, and Silence Handling

## Problems (from screenshot)

1. **Farsi text displayed incorrectly** — the circled text shows garbled/wrong Farsi output. The model outputs Farsi but it's inaccurate because OpenAI Realtime is generating its own content rather than translating.
2. **Model responds on its own** — "First, listen carefully to my voice" and "You shouldn't make a mistake, you shouldn't speak yourself" are clearly the model RESPONDING to the user rather than TRANSLATING what was said.
3. **Says "Nothing" when silent** — instead of staying completely quiet when there's no speech.

## Root Cause

The core problem is that **OpenAI Realtime is a conversational model** — it always generates a response to each user turn. Despite the strict prompt, the model treats each audio input as a conversation turn that needs a reply. The prompt alone cannot fully suppress this behavior.

## Plan

### 1. `src/hooks/useVoiceEngine.ts` — Aggressive client-side filtering

The self-talk filter needs to be much stronger:

- **Block agent transcripts that don't look like translations**: If user spoke Farsi (detected by RTL chars in last user transcript), agent output must contain ONLY English. If user spoke English, agent output must contain Farsi characters. If the output language matches the input language, it's self-talk — block it.
- **Block "Nothing" and similar fillers** more aggressively — expand the single-word blocklist
- **Add echo detection**: if agent text is suspiciously similar to user text (not a translation but a paraphrase), block it

### 2. `src/hooks/useAzinVoiceInterpreter.ts` — Reduce VAD sensitivity + add temperature

- Set `vadThreshold: 0.95` (was 0.9) to only trigger on very clear speech
- In the edge function, add `temperature: 0.6` to reduce creative/conversational outputs

### 3. `supabase/functions/voice-engine-token/index.ts` — Add temperature parameter

- Accept `temperature` from client config and pass it to OpenAI session creation
- Lower temperature = less creative = more mechanical translation behavior

### 4. `src/components/azin/AzinInterpreterVoiceChat.tsx` — Better Farsi rendering

- Ensure RTL text uses proper `font-family` with Persian-supporting fonts
- Add `lang="fa"` attribute on Farsi text elements for correct browser rendering

## Files to modify
- `src/hooks/useVoiceEngine.ts` — language-mismatch filter + stronger blocklist
- `src/hooks/useAzinVoiceInterpreter.ts` — higher VAD threshold, temperature param
- `supabase/functions/voice-engine-token/index.ts` — pass temperature to OpenAI
- `src/components/azin/AzinInterpreterVoiceChat.tsx` — add `lang` attribute for Farsi text

