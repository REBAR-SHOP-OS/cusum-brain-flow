

# Fix: Vizzy Voice Not Answering After Tool Execution

## Problem
When the CEO asks a question like "چند نفر در شرکت مشغول به کار هستند؟" (how many people work in the company?), Vizzy says "let me check..." and triggers an `investigate_entity` tool call. The tool executes successfully and the result is injected into the system prompt via `appendLiveResult`, but **no follow-up AI call is made**. Vizzy stops talking after "let me check..." and never delivers the actual answer.

The data (staff count, team presence) is already in the system prompt snapshot, so Vizzy should answer directly. But even when it does trigger a tool, the architecture lacks a follow-up mechanism.

## Root Cause
`VizzyVoiceChat.tsx` (line 134-184) executes `[VIZZY-ACTION]` tags and appends results to the system prompt, but the conversation flow ends there. There is no mechanism to automatically send a follow-up message to the AI saying "here's the tool result, now answer the question."

## Changes

### 1. Auto-follow-up after READ_ACTION results
**File**: `src/components/vizzy/VizzyVoiceChat.tsx`

After executing READ_ACTIONS (investigate_entity, deep_business_scan, etc.) and appending results via `appendLiveResult`, automatically inject a hidden follow-up user message like `"[TOOL_RESULTS_READY] Now answer my question using the tool results above."` and trigger `sendFollowUp()` from the voice engine. This makes the AI generate a second response using the fresh tool data.

### 2. Add `sendFollowUp` capability to voice engine
**File**: `src/hooks/useVizzyGeminiVoice.ts`

Expose a `sendFollowUp(internalPrompt: string)` function that:
- Adds the internal prompt to conversationRef (as a system/user message)
- Calls the `vizzy-voice-chat` edge function
- Streams the response and plays TTS
- This is the same as `processUserInput` but without creating a visible user transcript

### 3. Strengthen "answer from snapshot first" instructions
**File**: `src/hooks/useVizzyVoiceEngine.ts`

Add a rule near the top of the instructions:
```
═══ ANSWER FROM SNAPSHOT FIRST (CRITICAL) ═══
If the answer to the user's question EXISTS in your LIVE BUSINESS DATA or PRE-SESSION STUDY NOTES below, answer IMMEDIATELY from that data. Do NOT trigger investigate_entity or other tools for data you ALREADY have.
Only trigger tools when the specific data is NOT in your snapshot.
For "how many staff", "who is clocked in", "what's the revenue" — the answer is ALREADY in your data. USE IT.
```

## Scope
- 3 files modified
- No database or edge function changes

