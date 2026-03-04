

# Fix Contacts Tab & Make Contacts Clickable with Sub-Details

## Problem

The Contacts tab for "Kingdom Construction Limited" shows 2 entries both named "Kingdom Construction Limited" because:
1. The main customer record (`a7aec8da`) has auto-generated contacts with `first_name: "Kingdom"`, `last_name: "Construction Limited"` — bad data from the normalization trigger
2. The **real people** (Ben McCabe, Canberk Turkmen) exist as contacts under **child customer records** (`e02ae804` = "Kingdom Construction Limited, Ben McCabe", `3aff2a4a` = "Kingdom Construction Limited, Canberk Turkmen")
3. The current query only fetches contacts for the parent customer ID, missing the child records entirely

## Plan

### 1. Fix the Contacts query to include child customer records

Use `v_customer_company_map` to find all legacy customer IDs that map to this company, then fetch contacts from ALL of them. Filter out contacts where `first_name + last_name` matches the company name (bad auto-generated data).

```sql
-- Find all child customer IDs that map to this company
SELECT legacy_customer_id FROM v_customer_company_map 
WHERE company_customer_id = '<parent_id>'

-- Then fetch contacts from all those IDs
SELECT * FROM contacts WHERE customer_id IN (all_ids)
```

### 2. Make each contact clickable to show their own detail

When a contact is clicked, look up their parent `customer_id` (the child customer record like "Kingdom Construction Limited, Ben McCabe") and open that customer's full `CustomerDetail` view in a nested sheet/dialog. This gives each person their own:
- Transaction List
- Customer Details  
- Notes
- Projects (leads linked to their specific customer_id)
- Activity

### Files Changed

| File | Change |
|------|--------|
| `src/components/customers/CustomerDetail.tsx` | Update contacts query to fetch from all related customer IDs via `v_customer_company_map`, filter out company-name duplicates, make contact cards clickable to open a nested CustomerDetail for the child customer record |

