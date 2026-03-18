

## Plan: Fix Approve/Reject Icons on Purchasing List

### Problem
1. **Approve (✓) doesn't turn item green** — When clicking approve on a default item with no DB record, `addItemAsPurchased` inserts a new row. However, `findDbMatch` matches by exact `title + category`. The match works, but the issue is likely that the `togglePurchased` function uses `as any` casts unnecessarily when the table IS in the types, causing potential silent failures. Also, when toggling an already-purchased item back, it sets `is_purchased: false` but the item stays in DB with no visual feedback.

2. **Reject (✗) should HIDE/REMOVE the item** — Currently, reject marks the item red (`is_rejected: true`). The user wants rejected items to disappear from the list entirely.

### Changes

**File: `src/hooks/usePurchasingList.ts`**
- Remove unnecessary `as any` casts from `togglePurchased` and `toggleRejected` — the table exists in types
- Change `toggleRejected` behavior: instead of setting `is_rejected: true`, **delete the DB record** so the item disappears
- For default items with no DB match, `addItemAsRejected` should be replaced: instead of inserting a rejected record, we insert a record with `is_rejected: true` so it can be filtered out

**File: `src/components/purchasing/CompanyDefaultItems.tsx`**
- Filter out default items that have a DB match with `is_rejected === true` — rejected defaults should be hidden from the list
- Keep the approve flow as-is (green highlight)

**File: `src/components/purchasing/PurchasingListPanel.tsx`**
- Update reject handler: for items WITH a DB record, delete them; for items WITHOUT a DB record, insert as rejected (to persist the "hidden" state)

### Summary
| File | Change |
|------|--------|
| `src/hooks/usePurchasingList.ts` | Remove `as any` casts; fix toggle logic |
| `src/components/purchasing/CompanyDefaultItems.tsx` | Hide rejected default items from rendering |
| `src/components/purchasing/PurchasingListPanel.tsx` | Ensure reject = hide behavior |

