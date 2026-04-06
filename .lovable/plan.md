

# Stabilize Vizzy Voice Turn-Taking

## Problem
Vizzy sometimes interrupts itself mid-response — cuts off and gives a different answer. The OpenAI Realtime API's VAD (Voice Activity Detection) is picking up ambient noise or echo as "user speech," triggering a new response before the current one completes. The prompt-level instruction exists but the VAD parameters are too sensitive.

## Root Cause
1. **VAD threshold too low**: Currently `0.6` — background noise or speaker echo can trigger false "user speaking" events
2. **Silence duration too short**: `800ms` — OpenAI interprets brief pauses as end-of-turn, starts responding prematurely
3. **Prefix padding too short**: `400ms` — not enough buffer before detecting speech start
4. **No `eagerness` parameter**: OpenAI Realtime supports an `eagerness` field in `turn_detection` that controls how aggressively the model responds (`low` = wait longer)

## Changes

### 1. Increase VAD stability in `src/hooks/useVizzyVoiceEngine.ts` (line ~492-494)

Adjust the voice engine config:
- `vadThreshold`: `0.6` → `0.75` (require stronger signal to detect speech)
- `silenceDurationMs`: `800` → `1200` (wait 1.2s of silence before considering turn complete)
- `prefixPaddingMs`: `400` → `500` (more buffer before speech detection)

### 2. Add `eagerness` parameter to token edge function (`supabase/functions/voice-engine-token/index.ts`)

- Accept `eagerness` param from client (default `"low"`)
- Pass it in `turn_detection` config to OpenAI: `eagerness: "low"`
- This tells the model to wait longer before responding

### 3. Pass `eagerness` from voice engine hook (`src/hooks/useVoiceEngine.ts`)

- Add `eagerness` to the config interface (~line 26)
- Pass it through to the edge function call (~line 371)
- Default to `"low"` for conservative turn-taking

### 4. Strengthen turn-taking prompt in `src/hooks/useVizzyVoiceEngine.ts` (~line 310-315)

Add explicit instruction:
```
CRITICAL STABILITY RULE: If you are currently speaking and generating audio, you MUST complete your ENTIRE response before stopping. Do NOT abort mid-sentence to start a new response. If the user interrupts, finish your current sentence first, THEN acknowledge them. Never produce two overlapping responses.
```

## Result
- Higher VAD threshold reduces false triggers from echo/noise
- Longer silence duration prevents premature turn-ending
- `eagerness: "low"` makes the model wait for clear user intent
- Stronger prompt reinforces complete-before-responding behavior

## Files Changed
- `src/hooks/useVizzyVoiceEngine.ts` — VAD params + prompt update
- `src/hooks/useVoiceEngine.ts` — add `eagerness` to config interface
- `supabase/functions/voice-engine-token/index.ts` — pass `eagerness` to OpenAI

