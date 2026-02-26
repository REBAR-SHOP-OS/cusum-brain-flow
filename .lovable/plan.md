

## Plan: Keep Only Packing Slips Sub-Tab in Documents

Remove the "Invoices" and "Quotations" sub-tabs from the Documents section, keeping only "Packing Slips" as the sole document type tab.

### Changes in `src/components/accounting/AccountingDocuments.tsx`

1. **Remove "Invoices" and "Quotations" from `docTabs` array** (lines 209-213) — keep only the `packing-slip` entry.

2. **Remove the "Add New Quotation" button** (lines 261-267) — only the "Add Packing Slip" button remains, and it can always show since packing-slip is the only tab.

3. **Simplify the tab bar rendering** — since there's only one tab, either render it as a single static header or keep the single button. The tab switcher loop still works with one item.

4. **Keep all quotation/invoice preview and conversion logic intact** — these are still used from other entry points (Invoices tab, Dashboard). Only the sub-tab navigation is removed.

