

# Fix: Contact Dropdown Not Showing (Data Query Issue)

## Root Cause

The contacts query in `CustomerDetail.tsx` uses `v_customer_company_map` to find related customer IDs. But this view maps each comma-name child (e.g., "Kingdom Construction Limited, Ben McCabe") to **itself**, not to the parent company record. So:

1. Query asks: "What legacy IDs map to company_customer_id = Kingdom Construction Limited?"
2. Answer: Only the parent itself (`a7aec8da`)
3. Contacts query finds 2 contacts under that ID — both named "Kingdom Construction Limited" (auto-generated)
4. Name filter removes them (they match the company name)
5. Result: **0 contacts → dropdown hidden**

Meanwhile, the real contacts (Ben McCabe, Canberk Turkmen) are linked to the comma-name child customer IDs (`e02ae804`, `3aff2a4a`) which the query never finds.

## Fix

In the `allContacts` query (~line 195-222), **also find child customers by name pattern** (customers whose `name` starts with the company name + comma). This captures all comma-name variants.

```typescript
// Current (broken): only uses v_customer_company_map
const allIds = [customer.id, ...(mapRows || []).map(...)];

// Fixed: also find comma-name children
const companyPrefix = (customer.company_name || customer.name || "").split(",")[0].trim();
const { data: commaChildren } = await supabase
  .from("customers")
  .select("id")
  .ilike("name", `${companyPrefix},%`);

const allIds = [
  customer.id,
  ...(mapRows || []).map((r) => r.legacy_customer_id),
  ...(commaChildren || []).map((r) => r.id),
].filter((id, i, arr) => arr.indexOf(id) === i); // dedupe
```

## File Changed

| File | Change |
|------|--------|
| `src/components/customers/CustomerDetail.tsx` | Fix contacts query to include comma-name child customer IDs |

