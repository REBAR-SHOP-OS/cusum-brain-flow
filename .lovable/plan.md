
# Fix: Replace "I couldn't process that request" with Actionable Error Recovery

## Problem

The screenshot shows the Architect agent responding with "I couldn't process that request" -- a dead-end message that provides no help. This is NOT an LLM prompt issue. It is a **hardcoded fallback** at line 8739 of the edge function that triggers when the AI model returns an empty reply (e.g., after tool calls exhaust all output tokens or an internal loop exits without generating text).

The anti-deflection rules in the system prompt cannot prevent this because the message is injected by code AFTER the model finishes.

## Root Cause

```
// Line 8737-8740
if (reply === null || reply === undefined || reply.trim() === "") {
  reply = "I couldn't process that request.";
}
```

When the tool loop completes but no text reply was extracted, this fallback fires. Common triggers:
- Model used all output tokens on tool calls with no final text
- Tool loop hit max iterations without producing a reply
- Model returned only tool calls in the final turn

## Fix

### 1. Replace the generic fallback with a helpful recovery message
**File:** `supabase/functions/ai-agent/index.ts` (lines 8737-8740)

Replace the fallback with a context-aware message that:
- Acknowledges the issue honestly
- Asks the user to rephrase or provide more detail
- Includes what the agent was trying to do (the original message) for context

New fallback:

```
if (reply === null || reply === undefined || reply.trim() === "") {
  reply = "[STOP]\n\nI ran into an issue processing your request. This can happen when the task is complex or context is incomplete.\n\n**To move forward, please help me with:**\n1. Can you rephrase or simplify what you need?\n2. If this is about a specific record, provide the exact ID or name\n3. If this is a UI change, describe the exact page and element\n\nI have full read/write tools available -- I just need clearer input to use them effectively.";
}
```

This ensures:
- The `[STOP]` marker triggers the amber "Architect is blocked" banner in the UI
- The user gets specific, actionable next steps
- The agent never appears to give up or deflect

### 2. Add logging for empty-reply incidents
**File:** `supabase/functions/ai-agent/index.ts` (same block)

Add a `console.warn` before the fallback so empty-reply events are visible in edge function logs for debugging:

```
console.warn("Empty reply fallback triggered", { 
  agent, 
  toolLoopIterations, 
  messageLength: message?.length 
});
```

---

## Files Modified

| File | Change |
|------|--------|
| `supabase/functions/ai-agent/index.ts` | Replace generic fallback message with actionable recovery + logging |

## No Database Changes Required

## What This Fixes

- Eliminates the dead-end "I couldn't process that request" message
- Triggers the amber STOP banner so the user knows the agent needs input
- Provides 3 specific ways to help the agent proceed
- Adds observability via logging for future debugging
