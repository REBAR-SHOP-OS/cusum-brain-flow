

# Remove "Estimations" Tab from Documents Sub-Navigation

## Change

Remove the "Estimations" entry from the secondary tab strip inside the Accounting Documents section, keeping "Quotations" intact.

| File | Change |
|---|---|
| `src/components/accounting/AccountingDocuments.tsx` | Line 179: Delete `{ id: "estimation" as DocType, label: "Estimations", icon: Calculator, count: data.estimates.length },` from the tabs array |

Single line removal. The "Quotations" tab (line 178) remains unchanged. No other files affected.

