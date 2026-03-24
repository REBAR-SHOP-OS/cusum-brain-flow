

## Fix: Approved Cards Still Showing "Pending Approval"

### Root Cause

The card's approval status is checked using only `firstPost.neel_approved` (line 191, 237, 243), where `firstPost = posts[0]` — the first post in a grouped set. When a group has multiple posts (e.g., same content across multiple pages), `posts[0]` may not be the one that was approved. So even though Neel approved the post, the card shows "Pending Approval" because it's checking the wrong post in the group.

### Fix

**File**: `src/components/social/SocialCalendar.tsx`

Replace all `firstPost.neel_approved` checks with a group-level check that returns `true` if **any** post in the group is approved:

```typescript
const isApproved = posts.some(p => p.neel_approved);
```

Then use `isApproved` instead of `firstPost.neel_approved` in the three places:
- Line 191 (card border color)
- Line 237 (status text color)
- Lines 243-246 (status label text)

### Files Changed

| File | Change |
|---|---|
| `src/components/social/SocialCalendar.tsx` | Add `isApproved` variable, replace 3 occurrences of `firstPost.neel_approved` |

