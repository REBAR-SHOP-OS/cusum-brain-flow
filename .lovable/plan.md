

# Add Approve & Reject Icons for Purchasing Items

## Summary
Each item gets two action icons:
- **✓ (Check)** — marks item as approved/purchased → row turns **green**
- **✗ (X)** — marks item as rejected → row turns **red**

Currently the DB only has `is_purchased`. We need to add an `is_rejected` column to support the reject state.

## Database Migration
Add `is_rejected` boolean column to `purchasing_list_items`:
```sql
ALTER TABLE public.purchasing_list_items 
ADD COLUMN is_rejected boolean NOT NULL DEFAULT false;
```

## Code Changes

### 1. `src/hooks/usePurchasingList.ts`
- Add `is_rejected` to the `PurchasingItem` interface
- Add `rejectItem` function: sets `is_rejected = true, is_purchased = false`
- Add `unrejectItem` function: sets `is_rejected = false`
- Update `togglePurchased` to also clear `is_rejected` when approving

### 2. `src/components/purchasing/CompanyDefaultItems.tsx`
- Add `X` icon import from lucide-react
- Add `onMarkRejected` and `onUnmarkRejected` props
- Each `DefaultRow` gets two buttons side by side:
  - Green check button (approve) — same as current
  - Red X button (reject) — marks item red
- Row styling: green background tint when approved, red background tint when rejected
- Text: green + line-through when approved, red when rejected

### 3. `src/components/purchasing/PurchasingListPanel.tsx`
- Pass `onMarkRejected` / `onUnmarkRejected` to `CompanyDefaultItems`
- Add same two-icon pattern for dynamic (custom-added) items
- Wire up the reject/unreject calls from the hook

## Item States
| State | Check icon | X icon | Row style |
|-------|-----------|--------|-----------|
| Default | Gray | Gray | Normal |
| Approved | Green filled | Gray | Green tint |
| Rejected | Gray | Red filled | Red tint |

