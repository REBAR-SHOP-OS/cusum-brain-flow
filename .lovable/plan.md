
# Fix: `toolLoopIterations is not defined` Crashing AI Agent

## Problem

The edge function logs show a fatal error:
```
Agent error: ReferenceError: toolLoopIterations is not defined
    at Server.<anonymous> (file:///...ai-agent/index.ts:10515:9)
```

This crashes the ENTIRE agent response, returning a non-2xx status code to the frontend, which displays "Edge Function returned a non-2xx status code."

## Root Cause

The recent empty-reply fallback change (line 8739) references `toolLoopIterations` in the `console.warn`, but that variable is declared at line 8346 inside a nested block scope. The fallback at line 8738 is OUTSIDE that block, so the variable does not exist there.

```text
Line 8346:  let toolLoopIterations = 0;   // <-- inside nested block
Line 8735:  }                             // <-- block ends here
Line 8738:  if (reply === ... "") {        // <-- OUTSIDE the block
Line 8741:    toolLoopIterations,          // <-- ReferenceError!
```

Every time the agent produces an empty reply (which can happen for many reasons), this crash fires instead of the recovery message.

## Fix

**File:** `supabase/functions/ai-agent/index.ts` (lines 8739-8743)

Replace the `console.warn` to remove the undefined variable reference:

```javascript
console.warn("Empty reply fallback triggered", { 
  agent, 
  messageLength: message?.length 
});
```

Simply remove `toolLoopIterations` from the log object. The `agent` and `messageLength` fields provide sufficient debugging context.

## Files Modified

| File | Change |
|------|--------|
| `supabase/functions/ai-agent/index.ts` | Remove `toolLoopIterations` from console.warn at line 8741 |

## What This Fixes

- The AI agent will stop crashing with "Edge Function returned a non-2xx status code"
- The actionable recovery message will actually display when the model returns empty
- All agent functionality (including the DM fix task) will work again
