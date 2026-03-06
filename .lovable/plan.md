

# Ensure Pixel Agent Generates Unique Images Per Chat Session

## Problem
The Pixel agent can produce similar or repeated images across different chat sessions because neither the image prompt nor the content generation prompt includes any session-specific uniqueness seed beyond `Date.now()`.

## Solution
Inject a **session-unique seed** (the chat session ID + a random UUID) into both the `generateDynamicContent` prompt and the `generatePixelImage` prompt. This forces the AI to produce distinct creative directions per session.

## Changes

### File: `supabase/functions/ai-agent/index.ts`

1. **`generateDynamicContent()`** (~line 60): Add a `sessionSeed` parameter. Inject it into the prompt as a uniqueness directive:
   - Add to the prompt: `"Session creative seed: {sessionSeed} — you MUST use this seed to create a COMPLETELY UNIQUE creative direction. Never repeat styles, angles, or visual concepts from other sessions."`
   - Generate the seed from session ID + `crypto.randomUUID()` at the call site

2. **Image prompt construction** (~line 547-550): Replace the simple `Date.now()` timestamp with the full session seed:
   - Change: `variation timestamp: ${Date.now()}` → `unique session seed: ${sessionSeed} — create a visually DISTINCT image that has never been generated before. Use unique color palette, composition, and artistic style.`

3. **Call site** (~line 536): Generate `sessionSeed` from context (session ID if available) + `crypto.randomUUID()` and pass it to both functions.

These are small, targeted edits — no database changes, no new files.

