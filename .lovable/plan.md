

## Fix: Items Reappearing After Approve & Edits Not Saved

### Problem Summary
Three issues are happening together, creating the impression that "Approve" and "Edit & Approve" do nothing:

1. **Auto-follow-up creates a clone**: After a successful approve+execute, the edge function `penny-execute-action` (lines 136-161) inserts a NEW `pending_approval` item for the same customer with `action_payload: {}` (empty). This makes it look like the item "came back" and any edits are "lost."

2. **Duplicate items accumulate**: The database currently has customers with up to 6 duplicate pending items (e.g., GLADIUS 7835 Inc has 6). Each "Scan Now" or auto-follow-up can pile up duplicates because the dedup logic doesn't catch follow-ups created by `penny-execute-action`.

3. **No immediate UI refresh**: The `approve` function in `usePennyQueue.ts` does not call `load()` after the mutation completes. It relies entirely on the realtime subscription, which has latency.

### Root Causes

**File: `supabase/functions/penny-execute-action/index.ts` (lines 136-161)**
After successful execution, the function unconditionally inserts a new follow-up item with an empty `action_payload: {}` and no dedup check. This is the main cause of items "reappearing."

**File: `src/hooks/usePennyQueue.ts` (line 92-93)**
The `approve` function does not await a `load()` call after the edge function completes. The UI stays stale until the realtime subscription fires.

### Solution

#### 1. Edge Function: Add dedup guard and stop auto-follow-up for escalations

**File: `supabase/functions/penny-execute-action/index.ts`**

- Before inserting the auto-follow-up (line 146), add a dedup check: query `penny_collection_queue` for any existing `pending_approval` item with the same `customer_name` and skip if one exists
- Set `action_payload` on the follow-up to carry forward relevant context (invoice list, customer info) instead of `{}`
- Keep the auto-follow-up feature (it's useful) but prevent duplicates

#### 2. Hook: Force refetch after approve/reject/schedule

**File: `src/hooks/usePennyQueue.ts`**

- Add `await load()` at the end of `approve`, `reject`, and `schedule` callbacks, after the DB update and edge function call complete
- This ensures the UI immediately reflects the new state without waiting for realtime

#### 3. Data cleanup: Remove existing duplicates

- Run a one-time migration or manual query to deduplicate existing `pending_approval` items, keeping only one per customer

### Technical Details

| File | Change | Detail |
|------|--------|--------|
| `penny-execute-action/index.ts` | Add dedup check before follow-up insert (line ~146) | Query for existing pending item with same `customer_name`; skip insert if found |
| `penny-execute-action/index.ts` | Carry forward context in follow-up `action_payload` | Copy invoice details from parent action instead of `{}` |
| `usePennyQueue.ts` | Add `await load()` after approve (line ~93) | Force immediate UI refresh |
| `usePennyQueue.ts` | Add `await load()` after reject (line ~109) | Force immediate UI refresh |
| `usePennyQueue.ts` | Add `await load()` after schedule (line ~122) | Force immediate UI refresh |
| Database | One-time cleanup of duplicate pending items | Keep newest per customer, reject the rest |

### What This Does NOT Touch
- The `/accounting` page core logic or UI
- The feedback modal
- Any other components or pages
- The `penny-auto-actions` scan logic (its dedup already works correctly)

