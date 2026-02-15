

# Fix "No Response from AI" Timeout on Complex Requests

## Root Cause

When you ask for a "full comprehensive audit," the AI calls **multiple tools** (e.g. `wp_list_products`, `wp_list_posts`, `wp_list_pages`, `wp_list_orders`, `wp_get_site_health`). The edge function then:

1. Waits up to **55 seconds** for the first AI call to fully stream (buffering everything)
2. Executes each tool call **sequentially** (each WP API call takes 1-3 seconds)
3. Makes a **second AI call** with a 45-second timeout to summarize results

This easily exceeds the edge function's wall-clock limit. The function dies, the client gets no SSE data, and shows "No response from AI."

There are **three compounding problems**:

| Problem | Impact |
|---------|--------|
| Tool calls execute sequentially | 5 WP calls x 2s each = 10s wasted |
| First AI response is fully buffered before tools run | Wastes 5-15s reading a stream that's just tool call JSON |
| Follow-up AI call uses the heavy `gemini-3-pro-preview` model | Slow model for what's essentially a summary task |
| No streaming to client during tool execution | Client sees nothing for 30-60s, thinks it's dead |

## Fix Plan

### 1. Parallelize Tool Execution

**File: `supabase/functions/admin-chat/index.ts` (~line 1108-1148)**

Change the sequential `for` loop to `Promise.all` so all read tools execute concurrently.

```text
Before: for (const tc of toolCalls) { await executeReadTool(...) }
After:  await Promise.all(toolCalls.map(tc => executeReadTool(...)))
```

This cuts tool execution from ~10s to ~2-3s for multi-tool requests.

### 2. Send Progress SSE Events During Tool Execution

Instead of the client seeing nothing while tools run, send lightweight SSE progress events. The client already handles SSE parsing, so we can send interim content deltas like "Checking products..." before the final AI summary.

### 3. Use a Faster Model for the Follow-Up Summary

**File: `supabase/functions/admin-chat/index.ts` (~line 1179)**

The follow-up call just summarizes tool results. Switch it from `gemini-3-pro-preview` to `gemini-3-flash-preview` which is 3-5x faster for this type of task.

### 4. Reduce Follow-Up Timeout and Add Graceful Fallback

**File: `supabase/functions/admin-chat/index.ts` (~line 1167)**

- Reduce follow-up timeout from 45s to 25s
- If the follow-up times out, instead of failing silently, return the raw tool results formatted as markdown (the data is already collected)

### 5. Stream the Follow-Up Response Immediately

**File: `supabase/functions/admin-chat/index.ts` (~line 1207-1250)**

Currently, when there are pending write actions, the follow-up response is fully buffered. For read-only tool results (no pending actions), pipe the follow-up stream directly to the client using `TransformStream` so tokens appear immediately.

### 6. Improve Client-Side Timeout Handling

**File: `src/hooks/useAdminChat.ts`**

The current fallback message ("No response from AI") appears when the stream ends with zero content. Add:
- A 90-second client-side timeout that shows "This is taking longer than usual..." after 30s
- A retry suggestion in the timeout message mentioning specific simpler commands

## Files Modified

1. `supabase/functions/admin-chat/index.ts` -- Parallel tool execution, faster follow-up model, progress events, streaming response, graceful timeout fallback
2. `src/hooks/useAdminChat.ts` -- Better timeout UX with progress indicator

## Technical Details

### Parallel Tool Execution (core fix)

```text
// Current (sequential, ~10s for 5 tools):
for (const tc of toolCalls) {
  result = await executeReadTool(supabase, toolName, args);
}

// Fixed (parallel, ~2-3s for 5 tools):
const results = await Promise.all(toolCalls.map(async (tc) => {
  const args = JSON.parse(tc.function.arguments);
  if (WRITE_TOOLS.has(tc.function.name)) {
    return { ...tc, result: "queued", pending: true };
  }
  const result = await executeReadTool(supabase, tc.function.name, args);
  return { ...tc, result, pending: false };
}));
```

### Graceful Timeout Fallback

When the follow-up AI call times out, format the raw tool results as a readable summary instead of showing an error:

```text
catch (followErr) {
  // Instead of error, format raw results
  const fallback = toolResults.map(tr =>
    `**${tr.tool_name}:**\n${formatToolResult(tr.content)}`
  ).join("\n\n");
  // Stream fallback as SSE
}
```

### Follow-Up Model Change

```text
// Line ~1179: change model for follow-up call
model: "google/gemini-3-flash-preview",  // was gemini-3-pro-preview
```

## Expected Outcome

- Complex multi-tool requests complete in ~15-20s instead of timing out at 60s+
- Users see progress indicators while tools execute
- If AI summary times out, raw data is still displayed (no more empty responses)
- Simple requests remain unaffected
