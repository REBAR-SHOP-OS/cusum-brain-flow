

## Fix: Approved Posts Still Showing "Pending Approval"

### Root Cause

There are **two approval paths** in the app, and they are inconsistent:

1. **ApprovalsPanel** (`useSocialApprovals.ts` → `approvePost`): Updates `social_approvals` status to "approved" and sets `social_posts.status = "scheduled"` + `qa_status = "approved"` — but **never sets `neel_approved: true`**
2. **PostReviewPanel** (line 940): Correctly sets `neel_approved: true` on the post

When Neel approves posts through the Approvals panel, the `neel_approved` flag stays `false`. The calendar card (SocialCalendar.tsx line 237) checks `neel_approved` to show the "Approved" badge. Additionally, if the RLS policy blocks the status update on `social_posts`, the post remains stuck at `pending_approval`.

### Fix (1 file, 1 line addition)

**File: `src/hooks/useSocialApprovals.ts`** — line 71

Current:
```typescript
.update({ status: "scheduled", qa_status: "approved" })
```

Fixed:
```typescript
.update({ status: "scheduled", qa_status: "approved", neel_approved: true })
```

This ensures the Approvals panel approval path sets the same flag as the PostReviewPanel path.

### Why Safe
- Additive — only adds one field to an existing update
- Both approval paths will now produce the same post state
- No route, schema, or UI changes
- Calendar card already has the rendering logic for `neel_approved` (line 237)

### Rollback
Remove `, neel_approved: true` from the update call.

### Regression Risk
None — `neel_approved: true` is the correct end-state for approved posts regardless of which path triggers it.

