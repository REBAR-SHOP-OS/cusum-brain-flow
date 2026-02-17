

# Show Payment History in Invoice Edit Mode (QuickBooks Style)

## What's Happening Now

The payment history section exists at the bottom of the invoice but the data is working correctly -- 1,843 payment records are synced and the `Line.LinkedTxn` matching logic correctly links them to invoices. The issue is **layout and visibility**: payment history needs to be prominently displayed in the header area (like QuickBooks does), especially when editing.

## What Changes

### `src/components/accounting/InvoiceEditor.tsx`

1. **Move payment summary into the header area** -- Add a compact payment history box (Date + Amount Applied table) next to the invoice date fields in the top-right section. This mirrors the QuickBooks layout shown in the reference screenshot where payment details appear in the upper-right corner alongside the PAID badge.

2. **Keep it visible in both view and edit modes** -- The payment history box will always display when there are linked payments or a non-zero paid amount. It should show:
   - A "PAYMENT STATUS" label with the PAID/PARTIAL/OPEN badge
   - A small table with Date and Amount Applied columns for each linked payment
   - A summary line like "4 payments made on [latest date]"

3. **Remove the redundant bottom payment section** -- Since payment info will now be in the header, the bottom section becomes redundant. Alternatively, keep a simplified version at the bottom for print layout.

### Technical Details

- The `linkedPayments` array already contains the correct data (extracted from `payments` prop via `Line[].LinkedTxn[]` matching)
- The `mirrorTxnToQBFormat` function returns the full `raw_json` for payments, which includes the `Line` array with `LinkedTxn` references
- No backend changes needed -- all 1,843 payment records are already synced and contain proper `raw_json` with `Line` data
- The header payment box will use a bordered container with the same styling as the reference (blue date links, right-aligned amounts, green PAID badge)
