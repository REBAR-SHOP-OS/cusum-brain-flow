

## Plan: Show Full Date on Email Viewer

### Problem
The email date on line 336 of `InboxEmailViewer.tsx` displays `email.fullDate`, which is formatted as `"MMM d, h:mm a"` (e.g., "Mar 5, 2:30 PM") — missing the year. The user needs to see the complete date.

### Fix

**File: `src/components/inbox/InboxView.tsx`** (line 229)

Change the `fullDate` format from:
```typescript
fullDate: receivedDate ? format(receivedDate, "MMM d, h:mm a") : "",
```
to:
```typescript
fullDate: receivedDate ? format(receivedDate, "EEEE, MMM d, yyyy 'at' h:mm a") : "",
```

This will display dates like: **"Wednesday, Mar 5, 2025 at 2:30 PM"**

Single line change, one file.

