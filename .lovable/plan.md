

# Fix: Approved Posts Still Showing "Pending Approval" in Calendar

## Root Cause

In `PostReviewPanel.tsx` line 1097, the Neel approval button only sets `neel_approved: true` but does **not** update `status` from `"pending_approval"` to `"scheduled"`. The calendar renders status labels based on `post.status`, so posts remain displayed as "Pending Approval" even after Neel clicks approve.

Compare with `useSocialApprovals.approvePost` (line 66-72), which correctly sets **both** `status: "scheduled"` and `neel_approved: true`.

## Fix

**File: `src/components/social/PostReviewPanel.tsx` — line 1097**

Change:
```typescript
await updatePost.mutateAsync({ id: p.id, neel_approved: true } as any);
```

To:
```typescript
await updatePost.mutateAsync({
  id: p.id,
  neel_approved: true,
  status: "scheduled",
  qa_status: "approved",
} as any);
```

This mirrors the behavior of `useSocialApprovals.approvePost` and ensures the calendar immediately shows "Scheduled · Approved" after Neel approves.

## File Changed
- `src/components/social/PostReviewPanel.tsx` — line 1097: include `status` and `qa_status` in approval mutation

