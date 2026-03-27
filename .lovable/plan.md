

# Fix: Customer Dropdown Not Searchable in Generate AI Quotation Dialog

## Problem
The Customer dropdown in `GenerateQuotationDialog.tsx` uses a basic `Select` component with no search/filter capability. With 2,657+ customers, users cannot find customers by typing. Additionally, the query has no `.limit()`, so only the first 1,000 are loaded.

## Fix

### `src/components/accounting/GenerateQuotationDialog.tsx`

Replace the `Select` component for Customer with a **Popover + Command (combobox)** pattern with search-on-type:

1. **Remove** the bulk `customers_for_quote` query (lines 81-92)
2. **Add** state: `customerSearch`, `customerOpen`, `customerOptions`
3. **Add** a `useEffect` that debounces (300ms) and queries `v_customers_clean` with `.ilike` on `display_name` or `company_name`, `.limit(50)`
4. **Replace** the `<Select>` with a `Popover` + `Command` + `CommandInput` + `CommandList` pattern — same approach already used in `DraftQuotationEditor.tsx`
5. When a customer is selected, store both `selectedCustomerId` and display name

This matches the pattern already implemented in `DraftQuotationEditor.tsx` for consistency.

## Files Changed
- `src/components/accounting/GenerateQuotationDialog.tsx` — replace Select with searchable combobox

