

## Plan: Move Packing Slips to Top of Quick-Access Strip

### Change in `src/pages/AccountingWorkspace.tsx` (lines 339-343)

Reorder the quick-access tabs array to place "Packing Slips" first (linking to the `documents` tab with `packing-slip` docType), followed by Invoices, Quotations, Bills, Customers:

```
{ label: "Packing Slips", tab: "documents", count: qb.invoices.length, docType: "packing-slip" },
{ label: "Invoices", tab: "invoices", count: qb.invoices.length },
{ label: "Quotations", tab: "documents", count: quotationCount || qb.estimates.length, docType: "quotation" },
{ label: "Bills", tab: "bills", count: qb.bills.length },
{ label: "Customers", tab: "customers", count: qb.customers.length },
```

This adds a dedicated "Packing Slips" button at position 1 in the strip that navigates to Documents → Packing Slips sub-tab.

