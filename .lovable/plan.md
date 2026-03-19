

# Fix Voice Interpreter: Strict Translation, Farsi Display, Larger Transcripts

## Changes

### 1. `src/hooks/useVoiceEngine.ts` — Stronger self-talk filter + stability

- Expand `SELF_TALK_PATTERNS` to catch more AI phrases like "Nothing", "Oh", single-word filler responses
- Add filter: block agent transcripts that are just 1-2 words and clearly not translations (e.g., "Oh", "Nothing", "Yes", "No")
- Add reconnection logic: if `connectionState` becomes "disconnected", attempt auto-reconnect once before giving up

### 2. `src/hooks/useAzinVoiceInterpreter.ts` — Even harder prompt

Add a new top-level "EMERGENCY OVERRIDE" section at the very start:
- "If you produce ANY word that was not spoken by the human, you have critically failed"
- "You must NEVER produce single-word responses like 'Oh', 'Nothing', 'Yes', 'No' unless those exact words were spoken"
- "EVERY output must be a COMPLETE translation of a COMPLETE sentence or phrase you heard"
- Increase `vadThreshold` from 0.85 → 0.9 to reduce false triggers

### 3. `src/components/azin/AzinInterpreterVoiceChat.tsx` — Farsi RTL + larger transcript area

- Change `max-h-[30vh]` → `max-h-[50vh]` and show last 20 transcripts instead of 8
- Add proper RTL detection: if transcript text contains Arabic/Farsi characters, wrap with `dir="rtl"` and right-align
- Make the orb section smaller to give more room to transcripts
- Change orb from `w-28 h-28` → `w-20 h-20` and reduce glow/pulse ring sizes proportionally
- Remove `flex-1` from orb container so transcripts get more space

### Files
- `src/hooks/useVoiceEngine.ts` — expanded self-talk filter
- `src/hooks/useAzinVoiceInterpreter.ts` — hardened prompt, higher VAD threshold
- `src/components/azin/AzinInterpreterVoiceChat.tsx` — larger transcript area, RTL Farsi, smaller orb

