

# Remove Estimates from Quick-Access Tabs

## Change

Remove the "Estimates" entry from the quick-access navigation strip in `AccountingWorkspace.tsx`.

| File | Change |
|---|---|
| `src/pages/AccountingWorkspace.tsx` | Delete line 338: `{ label: "Estimates", tab: "estimates", count: qb.estimates.length },` |

Single line removal, no other files affected.

