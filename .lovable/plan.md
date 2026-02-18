
# Fix: ARIA Multi-Turn Loop — Conversation Loss and Silent Failures

## Root Cause (Confirmed)

The multi-turn tool loop has a **non-cumulative conversation** bug. Each iteration REPLACES the previous assistant message and tool results instead of APPENDING them to the conversation history.

### What happens:

```text
Iteration 1: [system, history, user, assistant1, toolResults1] -> model returns assistant2 + toolCalls2
Iteration 2: [system, history, user, assistant2, toolResults2] -> model LOST assistant1 + toolResults1!
```

The model on iteration 2 has no memory of what happened in iteration 1. For a 3-step fix (read_task -> db_read_query -> db_write_fix), the model loses the task details by the time it needs to write the fix. It gets confused and returns an empty response, triggering "I couldn't process that request."

### Additional bugs:
- **Silent API failure**: When the follow-up AI call returns a non-200 status (rate limit, timeout), the loop silently breaks with no logging
- **Empty reply fallback**: Empty string "" is treated as "no reply", triggering the fallback message

## Solution (3 surgical changes, same file)

### File: `supabase/functions/ai-agent/index.ts`

### Change 1: Cumulative conversation history

Replace the message construction (lines 8263-8282) to accumulate ALL previous assistant messages and tool results across iterations.

**Before:**
```typescript
const toolResultMessages = [
  ...messages,
  lastAssistantMsg,
  ...lastToolCalls.map(...)
];
```

**After:**
```typescript
// Accumulate conversation across iterations
accumulatedTurns.push(lastAssistantMsg);
accumulatedTurns.push(
  ...lastToolCalls.map(tc => {
    const seoResult = seoToolResults.find(r => r.id === tc.id);
    // ... same mapping logic
  })
);
const toolResultMessages = [...messages, ...accumulatedTurns];
```

Add `const accumulatedTurns: any[] = [];` before the while loop.

### Change 2: Log API failures in multi-turn loop

Replace the silent `break` at line 8300 with error logging.

**Before:**
```typescript
if (!followUp.ok) break;
```

**After:**
```typescript
if (!followUp.ok) {
  const errText = await followUp.text().catch(() => "unknown");
  console.error(`Multi-turn AI call failed (iter ${toolLoopIterations}): ${followUp.status} ${errText.substring(0, 200)}`);
  break;
}
```

### Change 3: Fix empty string fallback

Line 8608: change the falsy check to a strict check.

**Before:**
```typescript
if (!reply) reply = "I couldn't process that request.";
```

**After:**
```typescript
if (reply === null || reply === undefined || reply.trim() === "") {
  reply = "I couldn't process that request.";
}
```

## What This Fixes

- ARIA can now complete 3+ step autofix sequences (read_task -> db_read_query -> db_write_fix -> resolve_task) without losing context
- API failures in the multi-turn loop are logged for debugging
- Edge cases with empty string replies are handled correctly

## What This Does NOT Touch

- No database changes
- No UI changes
- No other agent or module affected
- First-pass tool handlers unchanged
- All existing guards, throttling, and safety checks preserved
- Tool handler logic unchanged

## Risk Assessment

- LOW risk: Only modifies the loop message construction, not the tool execution logic
- BACKWARD COMPATIBLE: If the model only needs 1 iteration, behavior is identical
- SAFE SERIALIZATION: `accumulatedTurns` is a simple array push, no mutation of existing data
