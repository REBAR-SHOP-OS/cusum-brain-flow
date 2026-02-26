

# Add "Quotations" Tab to Quick-Access Strip

## Change

Add a "Quotations" entry to the quick-access navigation strip, replacing where "Estimates" was.

| File | Change |
|---|---|
| `src/pages/AccountingWorkspace.tsx` | Line 338: Replace the blank line with `{ label: "Quotations", tab: "estimates", count: qb.estimates.length },` — reuses the existing estimates tab/data but displays as "Quotations" |

Single line addition, no other files affected. The tab will navigate to the existing estimates section but display the label "Quotations".

