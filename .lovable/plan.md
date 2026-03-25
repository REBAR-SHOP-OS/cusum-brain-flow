

## Fix Inbox Summary Total Count

### Problem
The AI Summary panel shows the total count of *all* emails (including hidden/snoozed) instead of the count of currently visible emails.

### Root Cause
Line 536 in `src/components/inbox/InboxView.tsx` uses `allEmails.length` for `totalEmails`, but the user only sees the filtered `emails` list (which excludes hidden and snoozed items).

### Fix

**File: `src/components/inbox/InboxView.tsx` (line 536)**

Change:
```typescript
setSummary({ totalEmails: allEmails.length, toRespond, fyi, marketing, spam, highlights });
```
To:
```typescript
setSummary({ totalEmails: emails.length, toRespond, fyi, marketing, spam, highlights });
```

Also update the category counts (lines 525-528) to use `emails` instead of `allEmails` so all numbers are consistent with what the user sees:
```typescript
const toRespond = emails.filter(...)
const fyi = emails.filter(...)
const marketing = emails.filter(...)
const spam = emails.filter(...)
```

This ensures the summary card reflects only the emails currently visible to the user.

| File | Change |
|---|---|
| `src/components/inbox/InboxView.tsx` | Replace `allEmails` with `emails` in the summarize action (lines 525-536) |

