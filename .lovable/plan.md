
# Make "Act" Button Navigate to the Exact Entity

## Problem

When clicking "Act" on a suggestion card (e.g., "Unknown -- $1695 overdue (23d)"), the user is taken to a generic page like `/accounting?tab=invoices` instead of being deep-linked to the specific invoice, customer, or order. The user has to manually search for the entity.

## Solution (Two Parts)

### Part 1: Frontend -- Make AccountingWorkspace read URL params

**File: `src/pages/AccountingWorkspace.tsx`**

- Read `?tab=` and `?search=` query parameters from the URL using `useSearchParams`
- On mount, if `tab` param is present, set `activeTab` to that value (e.g., `invoices`, `actions`)
- If `search` param is present, pass it down to the active tab component as an initial search value

**File: `src/components/accounting/AccountingInvoices.tsx`**

- Accept an optional `initialSearch` prop
- Initialize the `search` state from `initialSearch` instead of empty string, so the invoice list auto-filters to the specific entity on load

### Part 2: Backend -- Generate entity-specific deep links

**File: `supabase/functions/generate-suggestions/index.ts`**

Update all `actions` paths to include the specific entity identifier as a search parameter so the user lands on the right tab with the right entity pre-filtered:

| Suggestion Type | Current Path | New Path |
|---|---|---|
| Overdue invoice (Vizzy) | `/accounting?tab=invoices` | `/accounting?tab=invoices&search=CustomerName` |
| Overdue invoice (Penny) | `/accounting?tab=invoices` | `/accounting?tab=invoices&search=CustomerName` |
| $0 order | `/orders` (dead -- no `/orders` route) | `/accounting?tab=orders&search=OrderNumber` |
| Blocked production | `/orders` | `/accounting?tab=orders&search=OrderNumber` |
| Missing QB customer | `/customers` | `/customers?search=CustomerName` |
| Idle machine | `/shop-floor` | `/shop-floor` (no change -- already correct) |
| At-risk job | `/shop-floor` | `/shop-floor` (no change) |
| Collection follow-up | `/accounting?tab=actions` | `/accounting?tab=actions` (already correct) |
| Paid revision | `/orders` | `/accounting?tab=orders&search=OrderNumber` |

### Part 3: Customers page -- read search param

**File: `src/pages/Customers.tsx`**

- Read `?search=` from the URL and use it as the initial search filter value, so "View Customer" links land with the customer pre-highlighted.

## Technical Details

### AccountingWorkspace.tsx changes
```typescript
import { useSearchParams } from "react-router-dom";

// Inside component:
const [searchParams] = useSearchParams();
const urlTab = searchParams.get("tab");
const urlSearch = searchParams.get("search") || "";

// Initialize activeTab from URL if present
const [activeTab, setActiveTab] = useState(urlTab || "dashboard");

// Pass urlSearch to active tab components:
// <AccountingInvoices data={qb} initialSearch={activeTab === "invoices" ? urlSearch : ""} />
```

### AccountingInvoices.tsx changes
```typescript
interface Props {
  data: ReturnType<typeof useQuickBooksData>;
  initialSearch?: string;
}

// Initialize search from prop:
const [search, setSearch] = useState(initialSearch || "");
```

### generate-suggestions/index.ts changes (example for overdue invoices)
```typescript
// Before:
actions: [{ label: "View AR", action: "navigate", path: "/accounting?tab=invoices" }]

// After:
actions: [{ label: "View Invoice", action: "navigate", 
  path: `/accounting?tab=invoices&search=${encodeURIComponent(customerName)}` }]
```

Similar pattern applied to all suggestion types with entity-specific search terms (customer name, order number, etc.).

### No database changes required
