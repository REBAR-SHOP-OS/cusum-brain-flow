

# Match Print Preview Remark with Tags & Export Cards

## Problem
The `/print-tags` page passes `row.reference` as **Ref** and `row.address` as **Remark** to `RebarTagCard`. The Tags & Export cards were already updated to use session-level fields (`invoice_number` for Invoice/Ref, `session.name` for Remark/Scope). The print preview is out of sync — it shows the old address instead of the scope.

## Changes — `src/pages/PrintTags.tsx`

### 1. Fetch session `invoice_number` and `name` (scope)
Update the `useEffect` query on line 25 to also select `invoice_number` and `name` from `extract_sessions`, and store them in new state variables (`sessionInvoice`, `sessionScope`).

### 2. Pass session-level fields to RebarTagCard
- Line 129: Change `reference={row.reference || ""}` → `reference={sessionInvoice}`
- Line 130: Change `address={row.address || sessionAddress || projectAddress || ""}` → `address={sessionScope}`

This makes the print output match the Tags & Export card view exactly.

## Impact
- 1 file changed: `PrintTags.tsx`
- Print tags will show session `invoice_number` as Ref and session `name` (scope) as Remark, matching the card view

