

## Neel Approval — Add Visual Feedback on Click

### Current State
The approval system **already works correctly**: clicking "Neel Approval" saves `neel_approved: true` to the database and the button changes to "Approved by Neel ✅" after the query refreshes. The database confirms all current posts are `neel_approved: false` — they simply haven't been approved yet.

### Problem
There's no immediate visual feedback when Neel clicks the button. The mutation runs silently and the button only changes after the query refetches (~500ms delay), which can make Neel unsure if it saved.

### Fix
Add a local loading state to the "Neel Approval" button:

**`src/components/social/PostReviewPanel.tsx`**:
1. Add `approvingNeel` state (`useState(false)`)
2. Set it to `true` before the batch mutation loop, `false` after
3. Show a spinner + "Approving..." text while saving
4. Disable the button during the mutation to prevent double-clicks

This gives Neel instant visual confirmation that his click registered and the save is in progress. Once the query refreshes, the button permanently changes to "Approved by Neel ✅".

