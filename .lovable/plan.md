

# Fix: AZIN Generating Responses Instead of Translating

## Problem

As shown in the screenshot, after the user says "خیلی دوست دارم" (I really like you), AZIN correctly translates it but then generates its own response: "What are you doing today?" — this is conversational behavior, not translation. The model must NEVER generate original speech.

## Root Cause

Two issues:

1. **The prompt needs to be more aggressive** — current prompt says "NEVER speak on your own" but GPT-4o Realtime is a conversational model that defaults to responding. It needs explicit, repeated reinforcement that it is NOT a conversational agent and must NEVER generate responses to what it hears.

2. **The old `elevenlabs-azin-token` edge function still uses `gpt-4o-mini-realtime-preview`** with the old prompt — this should be updated too for consistency, even though it's not actively called from the client.

## Changes

### 1. Rewrite AZIN prompt with anti-response hardening
**File: `src/hooks/useAzinVoiceInterpreter.ts`**

Replace the current `AZIN_INSTRUCTIONS` with a much more aggressive prompt that:
- Explicitly forbids generating responses, follow-up questions, or reactions
- Repeats the core rule in multiple phrasings (reinforcement technique for realtime models)
- Adds explicit examples of forbidden behavior: "Do NOT reply, respond, react, ask questions, or continue the conversation"
- Frames identity as "a translation codec / relay device" — not an AI, not an assistant

### 2. Update the legacy `elevenlabs-azin-token` edge function
**File: `supabase/functions/elevenlabs-azin-token/index.ts`**

- Upgrade model to `gpt-4o-realtime-preview`
- Sync the prompt with the new hardened version
- Update VAD settings to match (silence: 600ms, prefix: 300ms)

## Technical Detail

The OpenAI Realtime API's conversational models have a strong default tendency to "respond" to user speech. Simple negative instructions ("don't respond") are often insufficient. The fix uses prompt reinforcement: stating the same constraint in 3-4 different ways, framing the model's identity as a non-agent device, and explicitly listing forbidden behaviors with examples.

