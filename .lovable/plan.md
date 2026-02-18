

# Fix: Multi-Turn Tool Call Loop for Empire Agent

## Root Cause
The `ai-agent` edge function only performs **one follow-up call** after processing tool calls (line 8088-8130). The Architect agent's autofix flow requires **multiple rounds**:

1. AI calls `read_task` to understand the problem
2. Follow-up returns tool results, AI then calls `resolve_task` (or other write tools)
3. **This second round of tool calls is never processed** -- the code only handles one follow-up
4. `reply` stays empty, so the fallback "I couldn't process that request." is returned

## Fix

### File: `supabase/functions/ai-agent/index.ts` (lines ~8086-8130)

Replace the single follow-up call with a **loop** that continues processing tool calls until the AI returns a text reply (or a max iteration limit is reached to prevent infinite loops).

**Before (simplified):**
```
if (seoToolResults.length > 0 || ...) {
  // single follow-up call
  const followUp = await fetch(aiUrl, ...);
  reply = followUpData.choices?.[0]?.message?.content || reply;
}
```

**After:**
```
let iterations = 0;
const MAX_TOOL_ITERATIONS = 5;

while (iterations < MAX_TOOL_ITERATIONS && 
       (seoToolResults.length > 0 || (!reply && (createdNotifications.length > 0 || emailResults.length > 0)))) {
  
  // Build tool result messages
  const toolResultMessages = [...messages, lastAssistantMessage, ...toolResultEntries];
  
  // Make follow-up call
  const followUp = await fetch(aiUrl, { ... });
  const followUpData = await followUp.json();
  const followUpChoice = followUpData.choices?.[0];
  
  // Check if follow-up returns more tool calls
  if (followUpChoice?.message?.tool_calls?.length > 0) {
    // Process new tool calls (read_task, resolve_task, etc.)
    // Push results to seoToolResults
    // Update lastAssistantMessage for next iteration
    seoToolResults = []; // reset for next round
    // ... process each tool call same as before ...
  }
  
  // Extract text reply if present
  if (followUpChoice?.message?.content) {
    reply = followUpChoice.message.content;
    break; // got a reply, stop looping
  }
  
  iterations++;
}
```

### Key Details
- Max 5 iterations to prevent infinite loops or runaway API costs
- Each iteration processes any new tool calls returned by the follow-up
- The loop breaks as soon as the AI returns a text `content` reply
- All existing tool handlers (read_task, resolve_task, create_fix_ticket, diagnose_from_screenshot, SEO tools, etc.) are reused inside the loop
- No changes needed to any frontend files

### Files Modified
- `supabase/functions/ai-agent/index.ts` -- Replace single follow-up block (lines ~8086-8130) with a multi-turn loop

### No Other Changes Needed
- No database changes
- No frontend changes
- No new files
