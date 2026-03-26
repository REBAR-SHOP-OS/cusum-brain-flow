
# Fix "Add Quote Manual" runtime error

## Problem
The manual quote editor crashes with:

```text
Cannot read properties of undefined (reading 'toLowerCase')
```

This happens in `src/components/accounting/documents/DraftQuotationEditor.tsx` when opening the customer picker.

## Root cause
`DraftQuotationEditor` loads customers from `v_customers_clean` using:

```ts
.select("customer_id, display_name, company_name")
```

But the component later assumes each customer has this shape:

```ts
{ id: string; name: string; ... }
```

So existing customer rows come in with `display_name` / `customer_id`, while the UI uses `c.name` and `c.id`. That makes `c.name` undefined and the filter crashes at:

```ts
c.name.toLowerCase()
```

## Fix
Apply a surgical fix only in:

- `src/components/accounting/documents/DraftQuotationEditor.tsx`

### Changes
1. Normalize customer rows from `v_customers_clean` into the local `CustomerOption` shape before saving to state:
   - `id = customer_id`
   - `name = display_name || company_name || "Unknown"`

2. Make customer filtering null-safe:
   - replace direct `c.name.toLowerCase()` with a safe fallback

3. Make customer rendering/select logic resilient:
   - use safe fallbacks where customer name is displayed
   - keep newly created customers working exactly as they do now

## Result
- Manual quote editor opens without crashing
- Customer search works for both existing and newly created customers
- The dropdown shows proper customer names instead of blank/undefined values
- No backend, routing, database, or unrelated UI changes

## File to change
- `src/components/accounting/documents/DraftQuotationEditor.tsx`

## Validation
After implementation, verify:
1. Open **Add Quote Manual**
2. Customer dropdown opens without error
3. Typing in search no longer crashes
4. Existing customers appear correctly
5. Creating a new customer still works
