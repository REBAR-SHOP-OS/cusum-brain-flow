

## Fix Vizzy Showing $0 AR and No Overdue Items

### Problem
Vizzy loads financial data by calling the `quickbooks-oauth` edge function directly. That function throws "QuickBooks not connected", so all financials (AR, overdue invoices, overdue bills) default to zero. The CEO Dashboard works correctly because it reads from the `accounting_mirror` table instead.

### Solution
Update `src/hooks/useVizzyContext.ts` to fall back to the `accounting_mirror` table when the QuickBooks edge function returns no data. This mirrors how the CEO Dashboard already works.

### Technical Details

**File:** `src/hooks/useVizzyContext.ts`

After the QuickBooks edge function call, add a fallback that queries `accounting_mirror`:

1. If `qbData` is null (QB not connected), query `accounting_mirror` for invoices and bills with `balance > 0`
2. Compute `totalReceivable`, `totalPayable`, `overdueInvoices`, and `overdueBills` from the mirror data
3. The rest of the context (production, CRM, deliveries, etc.) stays unchanged

The mirror table stores `entity_type` ("Invoice" / "Vendor"), `balance`, and `data` (JSON with DueDate, CustomerRef, VendorRef, etc.), so we can reconstruct the same financial picture Vizzy needs.

**No other files need to change** -- the context string builder in `vizzyContext.ts` already handles whatever data the snapshot provides.
