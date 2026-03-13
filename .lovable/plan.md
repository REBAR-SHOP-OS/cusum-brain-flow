

# Fix: Approved Pixel Posts Should Use Selected Date & Correct Status

## Problem
When a user selects a date in Pixel, generates posts, and clicks "Approve", the post is saved as `status: "draft"` with `qa_status` defaulting to null. This can make it less visible in the Social Media calendar. The date handling itself is already correct (uses `selectedDate`), but the status should reflect that it was approved.

## Changes

### `src/pages/AgentWorkspace.tsx`

**In `handleApprovePost` (line ~415):**
- Change `status` from `"draft"` to `"pending_approval"` so it appears in the "Pending Approval" filter
- Set `qa_status: "needs_review"` explicitly
- Add `neel_approved: false` to make approval flow clear

**In `handleApprovePixelSlot` (line ~331):**
- Same changes: `status: "pending_approval"`, `qa_status: "needs_review"`

Both functions already correctly use `selectedDate` with slot-based times, so no date logic changes needed.

## Result
Approved Pixel posts will appear under "Pending Approval" in the Social Media calendar on the exact date the user selected, making them immediately visible for scheduling workflow.

