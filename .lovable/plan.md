

## Sort Customers Alphabetically

### Problem
The Customers table in the Accounting workspace displays 1,946 customers in an unsorted order (e.g., "BOB HILL" appears before "Level Ltd" before "LIBERTY STONE"). They should be sorted A-Z by name.

### Solution
Add a `.sort()` call on the `enriched` array in `AccountingCustomers.tsx` to sort by `DisplayName` alphabetically (case-insensitive).

### Technical Details

**File: `src/components/accounting/AccountingCustomers.tsx`**

After the `enriched` array is built (around line 32), add a sort:

```typescript
enriched.sort((a, b) => a.DisplayName.localeCompare(b.DisplayName, undefined, { sensitivity: 'base' }));
```

This uses `localeCompare` with `sensitivity: 'base'` so that "bob" and "BOB" sort together correctly regardless of case.

One line change, no new dependencies.

