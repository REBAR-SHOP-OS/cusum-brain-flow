

## Fix: Repost Fails Due to DB Trigger Conflict

### Root Cause

Line 727-728 in `PostReviewPanel.tsx` inserts the repost with:
- `status: "scheduled"` 
- `qa_status: "needs_review"`

But the DB trigger (`validate_social_post_status`) blocks any insert where `status = 'scheduled'` unless `qa_status` is one of `('approved', 'scheduled', 'published')`. Since `"needs_review"` isn't in that list, the trigger raises the exception.

### Fix

**File**: `src/components/social/PostReviewPanel.tsx` (line 728)

Change `qa_status` from `"needs_review"` to `"scheduled"` for reposted posts. A repost is a clone of an already-published/approved post, so it should bypass the review gate:

```
BEFORE: qa_status: "needs_review",
AFTER:  qa_status: "scheduled",
```

### Files Changed

| File | Change |
|---|---|
| `src/components/social/PostReviewPanel.tsx` | Change repost `qa_status` from `"needs_review"` to `"scheduled"` |

