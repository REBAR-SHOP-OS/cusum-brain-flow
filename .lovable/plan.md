

# Pass Selected Date to Pixel Agent Backend

## Problem
When the user selects a date (e.g. 2026-02-14) in the Pixel agent calendar, the generated posts still show the previous date (2026-02-13) because the selected date is never sent to the backend edge function. The AI defaults to "today's date" instead of using the user's chosen date.

## Solution
Pass `selectedDate` as part of the request context to the edge function, and use it in the Pixel agent's prompt so all generated content reflects the correct date.

## Technical Changes

### 1. `src/pages/AgentWorkspace.tsx`
- In `handleSendInternal`, add `selectedDate` (formatted as `yyyy-MM-dd`) to the `extraContext` object when the agent is `social`:
```typescript
if (agentId === "social") {
  extraContext.selectedDate = format(selectedDate, "yyyy-MM-dd");
}
```

### 2. `src/lib/agent.ts`
- No changes needed -- `context` is already passed through to the edge function body.

### 3. `supabase/functions/ai-agent/index.ts`
- In the Pixel/social agent prompt section, read `context.selectedDate` from the request body.
- Replace any hardcoded "today" / `new Date()` references in the Pixel prompt with the user-provided date.
- If `context.selectedDate` is present, inject it into the system prompt so the AI generates posts for that specific date (e.g. "Generate content for date: 2026-02-14").

This is a minimal change: one line added in the frontend to pass the date, and a small update in the edge function to use it in the prompt.
