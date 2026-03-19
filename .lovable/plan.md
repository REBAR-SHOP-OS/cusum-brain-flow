

# Harden Nila Voice Interpreter: Ignore Non-Speech Audio & Absolute Translation-Only

## Problem
1. Laughter and non-speech sounds are being "translated" — should be completely ignored.
2. The agent still occasionally generates its own responses instead of purely translating.

## Changes

### 1. `src/hooks/useAzinVoiceInterpreter.ts` — Strengthen system prompt

Add explicit rules for non-speech audio handling and reinforce the absolute translation-only mandate:

**New rules to add:**
- **NON-SPEECH AUDIO**: Laughter, coughing, crying, clapping, sighs, gasps, background music, breathing — produce ZERO output. Do not translate sound effects. Do not describe sounds. Silence is the only correct response to non-speech audio.
- **ABSOLUTE ZERO TOLERANCE**: Add a "penalty framing" section making it crystal clear that generating ANY original content (even a single word not heard in input) is a critical violation.
- **Anti-hallucination**: If you are unsure whether you heard actual words, produce NO output. Silence is always safer than a wrong translation.
- **Laughter-specific example**: User laughs → You produce nothing. STOP. Not "haha", not "[laughter]", not any description.

**Restructure prompt** with layered reinforcement:
1. Identity declaration (codec, not AI)
2. Non-speech audio rule (BEFORE translation rules — highest priority)
3. Translation protocol
4. Never-answer rules
5. Forbidden actions (expanded)
6. Examples (including laughter/cough examples)
7. Final reinforcement statement

### 2. VAD threshold tuning
Keep `vadThreshold: 0.85` — already high, which is good for filtering noise. No change needed.

## Scope
- Single file edit: `src/hooks/useAzinVoiceInterpreter.ts` — rewrite `AZIN_INSTRUCTIONS` string
- No structural or backend changes

