

## Approvals Button → Filter Calendar to Approved Posts Only

### What
When clicking the "Approvals" button in the toolbar, instead of (or in addition to) showing the ApprovalsPanel, the calendar should filter to show **only approved cards** (`neel_approved === true`). Clicking again resets the filter.

### Changes

**File**: `src/pages/SocialMediaManager.tsx`

1. When `showApprovals` is toggled **on**, set `statusFilter` to `"approved_by_neel"` (which already exists in the filter logic at line 123-124):
   ```typescript
   onClick={() => {
     setShowApprovals((v) => {
       const next = !v;
       if (next) setStatusFilter("approved_by_neel");
       else setStatusFilter("all");
       return next;
     });
     setShowStrategy(false);
   }}
   ```

2. The existing `filteredPosts` logic already handles `statusFilter === "approved_by_neel"` at line 123-124:
   ```typescript
   if (statusFilter === "approved_by_neel") {
     items = items.filter((p) => p.neel_approved);
   }
   ```
   So no changes needed in the filter logic.

3. Keep the `ApprovalsPanel` visible when `showApprovals` is true (existing behavior preserved).

### Files Changed

| File | Change |
|---|---|
| `src/pages/SocialMediaManager.tsx` | Update Approvals button onClick to also set `statusFilter` to `"approved_by_neel"` / `"all"` |

