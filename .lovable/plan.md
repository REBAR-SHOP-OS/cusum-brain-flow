

## Fix Pending Approval Filter to Only Show Unapproved Posts

### Problem
When clicking the "Pending Approval" button, the calendar still shows Published and Scheduled posts alongside pending ones. The filter on line 126 only checks `!p.neel_approved` but doesn't exclude posts with terminal statuses (`published`, `declined`) or already-approved scheduled posts.

### Changes

**File**: `src/pages/SocialMediaManager.tsx` (lines 125-126)

Update the `pending_approval` filter branch to strictly show only posts that are truly pending approval:

```typescript
} else if (statusFilter === "pending_approval") {
  items = items.filter(
    (p) => !p.neel_approved 
      && p.status !== "published" 
      && p.status !== "declined"
  );
}
```

This ensures:
- Published posts are excluded
- Declined posts are excluded
- Only draft/scheduled posts that haven't been approved (`neel_approved: false`) are shown
- Matches the user's expectation: clicking "Pending Approval" shows ONLY cards waiting for approval

### Files Changed

| File | Change |
|---|---|
| `src/pages/SocialMediaManager.tsx` | Tighten `pending_approval` filter to exclude published/declined posts |

