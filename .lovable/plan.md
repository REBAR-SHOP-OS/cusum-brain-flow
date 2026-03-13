

# Add Sattar Approval as Alternative to Neel Approval

## Overview
Allow `sattar@rebar.shop` to also approve posts. Either Neel OR Sattar's approval is sufficient for publishing — both are not required.

## Changes

### 1. `src/components/social/PostReviewPanel.tsx` — Show approve button for Sattar too

Update the approval gate section (lines 702-746):
- When `neel_approved` is true → show "Approved" (already works)
- When current user is `neel@rebar.shop` **OR** `sattar@rebar.shop` → show the approve button
- Otherwise → show "Awaiting Approval"
- Update label from "Approved by Neel" to "Approved ✅" and button from "Neel Approval" to "Approve"

**Specific change at line 711:**
```typescript
) : (currentUserEmail === "neel@rebar.shop" || currentUserEmail === "sattar@rebar.shop") ? (
```

Update display labels:
- Line 709: `Approved by Neel ✅` → `Approved by Neel ✅` (keep, but we could also show who approved — however the DB only stores a boolean, so keep simple)
- Line 734: `Neel Approval` → `Approve Post`
- Line 744: `Awaiting Neel's Approval` → `Awaiting Approval`

### 2. No DB or edge function changes needed
- The `neel_approved` boolean column works for both users — it just gates publishing
- The edge function's server-side check (`neel_approved` field) already works regardless of who set it
- The cron job filter (`neel_approved: true`) also works unchanged

### Files
- `src/components/social/PostReviewPanel.tsx` — allow sattar to approve, update labels

