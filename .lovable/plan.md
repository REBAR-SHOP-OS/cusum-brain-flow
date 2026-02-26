

# Add Quick-Access Navigation Tabs with Counts to Accounting Header

## What the user wants
Based on the screenshot, the user wants a horizontal strip of tab-style buttons below the accounting header bar — similar to the reference UI showing "Invoices (1838)", "Packing Slips (1838)", "Quotations (2586)", "Estimations (0)". These act as quick shortcuts to navigate between key sections with item counts.

## Implementation

Add a secondary navigation strip below the existing header bar in `AccountingWorkspace.tsx` (after line 331, the closing `</div>` of the header). This strip will show quick-access buttons for the most-used sections with live counts from the `qb` data hook.

### Tabs to include (matching the screenshot context + existing sections):
| Tab Label | Navigation target | Count source |
|---|---|---|
| Invoices | `invoices` | `qb.invoices.length` |
| Estimates | `estimates` | `qb.estimates.length` |
| Bills | `bills` | `qb.bills.length` |
| Customers | `customers` | `qb.customers.length` |

### File change

**`src/pages/AccountingWorkspace.tsx`** — Insert a quick-nav strip between the header div (line 331) and the main content div (line 334):

```tsx
{/* Quick-access tabs */}
<div className="flex items-center gap-2 px-4 py-2 border-b border-border shrink-0 overflow-x-auto">
  {[
    { label: "Invoices", tab: "invoices", count: qb.invoices.length },
    { label: "Estimates", tab: "estimates", count: qb.estimates.length },
    { label: "Bills", tab: "bills", count: qb.bills.length },
    { label: "Customers", tab: "customers", count: qb.customers.length },
  ].map(item => (
    <Button
      key={item.tab}
      variant={activeTab === item.tab ? "default" : "outline"}
      size="sm"
      className="h-8 text-xs gap-1.5 shrink-0"
      onClick={() => setActiveTab(item.tab)}
    >
      {item.label}
      <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
        {item.count}
      </Badge>
    </Button>
  ))}
</div>
```

### Technical details
- Uses existing `qb` data from `useQuickBooksData` — no new queries needed
- `overflow-x-auto` on the container ensures horizontal scrolling works on narrow screens
- `shrink-0` on buttons prevents them from collapsing
- Active tab gets `variant="default"` styling, others get `variant="outline"`
- One file change only, ~20 lines added

