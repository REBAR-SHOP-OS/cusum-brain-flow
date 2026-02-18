

# Fix False "Session Expired" Toast and Group Suggestions by Customer

## Issues Identified

### 1. False "Session Expired" Toast
The `useFixRequestMonitor` hook polls `vizzy_fix_requests` and matches any open request containing the word "session" or "token" in its description. A fix request about "data refresh behavior per session" is triggering a misleading "Your session may have expired -- please re-login" toast, even though nothing is wrong with the user's auth session.

### 2. Cluttered Suggestion Cards
The Vizzy Suggestions panel shows one card per invoice, which leads to the same customer (e.g., GLADIUS 7835 Inc) appearing 3-5 times with similar cards. These are genuinely different invoices, but the UX would be much cleaner if grouped by customer.

---

## Plan

### Fix 1: Stop false "session expired" toasts

**File**: `src/hooks/useFixRequestMonitor.ts`

- Exclude auto-detected errors (already filtered with `not("description", "like", "Auto-detected:%")`) but also exclude **non-error fix requests** that happen to contain keywords like "session" or "token" in unrelated contexts.
- Solution: Only match the pattern if the description also contains error-related words (e.g., "expired", "unauthorized", "401", "invalid", "failed"), OR restrict matching to auto-detected entries only.
- Simplest robust fix: change the query filter to only look at descriptions that start with an error-like prefix OR contain both a keyword AND an error indicator. Alternatively, skip fix requests that are clearly feature requests (long descriptions, contain words like "implement", "add", "modify").

### Fix 2: Group suggestion cards by customer

**File**: `src/components/agent/AgentSuggestionsPanel.tsx`

- Group suggestions by customer name (extracted from the title before the em-dash).
- For groups with more than 2 invoices, show a single collapsed card like "GLADIUS 7835 Inc -- 3 overdue invoices ($33,227 total)" with an expandable section.
- Single-invoice customers keep the existing card layout unchanged.

**File**: `src/components/agent/AgentSuggestionCard.tsx`

- Add a new variant or wrapper component `GroupedSuggestionCard` that accepts multiple suggestions for the same customer, shows the total amount and count, and expands to show individual invoices with Act/Snooze/Dismiss per invoice.

---

## Technical Details

### useFixRequestMonitor.ts Changes

Add a smarter matching function that checks for actual error context, not just keyword presence:

```typescript
const ERROR_INDICATORS = ["expired", "unauthorized", "401", "403", "invalid", "failed", "error", "denied"];

function getActionableGuidance(description: string): string | null {
  const lower = description.toLowerCase();
  // Skip feature requests / long descriptions
  if (lower.includes("implement") || lower.includes("modify") || lower.includes("create") || lower.includes("build")) {
    return null;
  }
  // Only match if both a trigger keyword AND an error indicator are present
  for (const { pattern, guidance } of USER_ACTION_PATTERNS) {
    if (lower.includes(pattern)) {
      if (ERROR_INDICATORS.some(e => lower.includes(e))) {
        return guidance;
      }
    }
  }
  return null;
}
```

### AgentSuggestionsPanel.tsx Changes

Group suggestions by customer:

```typescript
// Extract customer name from title (everything before " -- ")
function groupByCustomer(suggestions: AgentSuggestion[]) {
  const groups = new Map<string, AgentSuggestion[]>();
  for (const s of suggestions) {
    const match = s.title.match(/^(.+?)\s*[—–-]\s*\$/);
    const key = match?.[1]?.trim() ?? s.title;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }
  return groups;
}
```

- Groups with 1-2 items: render individual `AgentSuggestionCard` as before.
- Groups with 3+ items: render a `GroupedSuggestionCard` showing customer name, total amount, invoice count, with a "Show all" toggle to expand individual cards.

### New Component: GroupedSuggestionCard

A collapsible card that:
- Shows customer name, total amount at risk, number of invoices, highest severity badge
- "Show all" button expands to show individual action buttons per invoice
- Bulk "Dismiss All" and "Snooze All" options for the group

