

# Fix Purchasing List: Items Display + Bought/Not Bought Buttons

## Issues
1. **Perpetual "Loading..."** — Items exist in DB with `company_id = a0000000-...` and RLS policies are correct. The likely cause is the `as any` type cast on the table name which may cause a runtime query issue, or the `loading` state never gets set to `false` when `user` or `company_id` is missing (the function returns early without setting `setLoading(false)`).

2. **UI Change** — Replace the single checkbox with two explicit icon buttons: a green **check (✓) Bought** button and a red **✗ Not Bought** button.

## Changes

### 1. `src/hooks/usePurchasingList.ts` — Fix loading stuck
- In `fetchItems`, add `setLoading(false)` to the early returns (when `!user` or `!profile?.company_id`), so the UI doesn't stay on "Loading..." forever.

### 2. `src/components/purchasing/PurchasingListPanel.tsx` — Replace checkbox with two buttons
- Remove the `Checkbox` import, add `Check` and `X` from lucide-react
- Replace the single `<Checkbox>` per item with two small icon buttons side by side:
  - **✓ (Check)** — green highlight when `is_purchased === true`, calls `togglePurchased` to mark as bought
  - **✗ (X)** — red highlight when `is_purchased === false`, calls `togglePurchased` to mark as not bought
- Each button shows its active state visually (filled bg when selected, ghost when not)

### Visual per item row:
```text
[✓] [✗]  Item Title  ×2  Office  Normal  [🗑]
 ^    ^
 |    └─ Red when NOT purchased (active)
 └───── Green when purchased (active)
```

## Files Changed

| File | Change |
|------|--------|
| `src/hooks/usePurchasingList.ts` | Fix early returns to set `loading = false` |
| `src/components/purchasing/PurchasingListPanel.tsx` | Replace checkbox with Bought/Not Bought icon buttons |

