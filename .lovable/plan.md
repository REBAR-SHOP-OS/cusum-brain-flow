

## Plan: Fix Profile Lookup in Purchasing List Hook

### Problem
In `src/hooks/usePurchasingList.ts`, all profile queries use `.eq("id", user.id)` instead of `.eq("user_id", user.id)`. Since `profiles.id` is not the auth user UUID (it's a separate column), these queries return no results. This causes `addItem`, `addItemAsPurchased`, `addItemAsRejected`, `confirmList`, and `fetchItems` to silently fail — items are never inserted or fetched.

Every other file in the codebase correctly uses `.eq("user_id", user.id)`.

### Fix
**File: `src/hooks/usePurchasingList.ts`**
- Replace all 6 occurrences of `.eq("id", user.id)` with `.eq("user_id", user.id)` in the profile lookup queries (lines ~32, 80, 101, 118, 143, 192).

This is a one-file, find-and-replace fix. No other changes needed.

