

# Fix: Acting on Suggestions Should Update Status Across the App

## Problem

You already followed up on "ET CONSTRUCTION INC" from the Accounting agent, but the suggestion still appears on the Home page under "Vizzy Suggestions." The "Act" button only logs the action -- it never marks the suggestion as resolved.

## Fix

**Single file change: `src/hooks/useAgentSuggestions.ts`**

In the `actOnSuggestion` mutation (around line 60), after logging the action to `agent_action_log`, add a database update to set the suggestion's `status` to `"acted"` and `resolved_at` to the current timestamp. Then add an `onSuccess` callback to invalidate the query cache -- the same pattern already used by `dismissSuggestion` and `snoozeSuggestion`.

Since the query filters by `status IN ("open", "new")`, changing status to `"acted"` automatically removes it from every suggestion list app-wide (Home page, Accounting agent, etc.).

## Technical Detail

```
// After the existing agent_action_log insert, add:
await supabase
  .from("suggestions")
  .update({ status: "acted", resolved_at: new Date().toISOString() })
  .eq("id", id);
```

Add `onSuccess` to invalidate `["agent-suggestions", agentCode]` cache (same as dismiss/snooze already do).

