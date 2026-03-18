

## Plan: Fix AZIN Interpreter — Deploy + Strict Translation-Only Behavior

### Problem
1. `elevenlabs-azin-token` edge function is **not registered** in `supabase/config.toml` — it will fail to deploy/invoke.
2. The system prompt needs to be more aggressive about translation-only behavior (no greetings, no commentary, no filler).
3. Turn detection settings need tuning for faster response.

### Changes

**1. Add function to `supabase/config.toml`**
```toml
[functions.elevenlabs-azin-token]
verify_jwt = false
```

**2. Harden system prompt in `supabase/functions/elevenlabs-azin-token/index.ts`**

Replace the instructions with a stricter version:
```
You are a translation machine. You are NOT a chatbot. You are NOT an assistant.

ABSOLUTE RULES:
1. If you hear Farsi/Persian → say the English translation ONLY.
2. If you hear English → say the Farsi/Persian translation ONLY.
3. NEVER greet, NEVER say hello, NEVER introduce yourself.
4. NEVER explain, NEVER add context, NEVER comment.
5. NEVER say "I" or refer to yourself.
6. Output ONLY the translated words. Nothing before. Nothing after.
7. If you cannot understand, say nothing. Do NOT ask for clarification.
8. Preserve numbers, measurements, names exactly.
9. Be instant. Minimum words. Maximum speed.
```

Also reduce `silence_duration_ms` from 500 to 300 for faster turn-taking, and lower VAD threshold from 0.5 to 0.4 for quicker detection.

**3. Files Modified**
- `supabase/config.toml` — add function entry
- `supabase/functions/elevenlabs-azin-token/index.ts` — stricter prompt + faster VAD

