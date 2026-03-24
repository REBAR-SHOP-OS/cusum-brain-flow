

## Move "Pending Approval" Filter Next to Approvals Button

### What
Move the "Pending Approval" pill from the status filter row (line 470) up to the toolbar, placing it right next to the "Approvals" button.

### Changes

**File**: `src/pages/SocialMediaManager.tsx`

1. **Add a "Pending Approval" button** next to the Approvals button (after line 317), styled similarly:
   ```tsx
   <Button
     variant={statusFilter === "pending_approval" ? "default" : "outline"}
     size="sm"
     className="gap-1.5"
     onClick={() => setStatusFilter(statusFilter === "pending_approval" ? "all" : "pending_approval")}
   >
     <Clock className="w-3.5 h-3.5" />
     <span className="hidden sm:inline">Pending Approval</span>
   </Button>
   ```

2. **Remove "Pending Approval" from `statusFilters` array** (line 46) so it no longer appears in the filter pills row below.

3. **Import `Clock`** icon (add to line 6 imports).

### Files Changed

| File | Change |
|---|---|
| `src/pages/SocialMediaManager.tsx` | Add Pending Approval button next to Approvals, remove from statusFilters array, import Clock icon |

