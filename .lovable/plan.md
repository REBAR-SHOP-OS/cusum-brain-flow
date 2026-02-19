
# Fix: Kanban Column Cards Not Sorted by Time

## Root Cause

In `src/components/inbox/InboxKanbanBoard.tsx`, the `emailsByLabel` grouping loop simply `.push()` each item into its column bucket in the order it arrives from the parent `allEmails` array. There is no sort step within each column. So cards appear in whatever order they were mapped from the database, not newest-first within each column.

The `InboxEmail` object already carries a `fullDate` field (formatted as `"MMM d, h:mm a"` — e.g., `"Feb 18, 12:35 PM"`). This is sufficient for comparison-based sorting within the same day, but a raw `receivedAt` ISO timestamp on the email object would be more reliable.

Looking at `InboxView.tsx` line 300: `comm.receivedAt` is available when building the mapped object. The `fullDate` string is parseable (e.g., `new Date("Feb 18, 12:35 PM")`) within the current year and is used elsewhere (line 378) for the 48h nudge check — confirming it works for comparison.

## What Will Be Changed

**File:** `src/components/inbox/InboxKanbanBoard.tsx`

**Where:** Lines 57–67, the column-bucketing block inside `InboxKanbanBoard`.

**Change:** After all emails are distributed into their column buckets, sort each column's array by `fullDate` descending (newest first) before rendering.

### Before (lines 57–67):

```tsx
const emailsByLabel: Record<...> = {};
KANBAN_COLUMNS.forEach((col) => {
  emailsByLabel[col.value] = [];
});
emails.forEach((email) => {
  if (emailsByLabel[email.label]) {
    emailsByLabel[email.label].push(email);
  } else {
    emailsByLabel["To Respond"]?.push(email);
  }
});
```

### After:

```tsx
const emailsByLabel: Record<...> = {};
KANBAN_COLUMNS.forEach((col) => {
  emailsByLabel[col.value] = [];
});
emails.forEach((email) => {
  if (emailsByLabel[email.label]) {
    emailsByLabel[email.label].push(email);
  } else {
    emailsByLabel["To Respond"]?.push(email);
  }
});

// Sort each column newest-first
KANBAN_COLUMNS.forEach((col) => {
  emailsByLabel[col.value].sort((a, b) => {
    const ta = a.fullDate ? new Date(a.fullDate).getTime() : 0;
    const tb = b.fullDate ? new Date(b.fullDate).getTime() : 0;
    return tb - ta; // descending
  });
});
```

## Scope

| File | Lines affected | Change |
|---|---|---|
| `src/components/inbox/InboxKanbanBoard.tsx` | ~57–67 (bucketing block) | Add per-column `.sort()` by `fullDate` descending after all pushes |

## What Is NOT Changed
- `InboxView.tsx` — the `allEmails` useMemo, the SMS thread collapsing, or any other logic
- `InboxEmailList.tsx` — the list view is unaffected
- Any database queries, edge functions, or other components
- The `fullDate` field itself — it's already populated correctly; we're just using it for an in-place sort
