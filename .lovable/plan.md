

# Fix "Pending Approval" Filter to Show Scheduled but Unapproved Posts

## Problem
Currently the "Pending Approval" filter shows posts with `status === "pending_approval"`. The user wants it to show posts that are **scheduled but not yet approved** (`status === "scheduled" && neel_approved === false`).

## Change
In `src/pages/SocialMediaManager.tsx`, line 110-111, add a special case for `pending_approval` before the generic status filter:

```typescript
} else if (statusFilter === "pending_approval") {
  items = items.filter((p) => p.status === "scheduled" && !p.neel_approved);
} else if (statusFilter !== "all") {
```

This replaces the current behavior where `pending_approval` falls through to the generic `p.status === statusFilter` check.

### File changed
- `src/pages/SocialMediaManager.tsx` (lines 110-111)

