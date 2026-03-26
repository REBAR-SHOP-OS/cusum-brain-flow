

# Fix: Contact Picker Missing Records (Supabase 1000-Row Limit)

## Root Cause

The `useSalesContacts` hook fetches from three sources without pagination:
- `contacts` table: **1,341 rows** → silently truncated to 1,000
- `v_customers_clean` view: **2,653 rows** → silently truncated to 1,000
- `sales_contacts` table: small, no issue

Swapzero and other recent customers are dropped because Supabase returns only the first 1,000 rows. After deduplication, the contact picker shows an incomplete list — so when the user selects a contact, it may not exist, and newly created leads may appear to "not work."

## Solution

Two changes in `src/hooks/useSalesContacts.ts`:

1. **Add `.limit(5000)`** to both the `contacts` and `v_customers_clean` queries to fetch all records (safe — these are lightweight rows with only name/email/phone fields)

2. **Add `.order("created_at", { ascending: false })`** to the `v_customers_clean` query so that if a limit is ever hit, the most recent customers (like Swapzero) are always included

## Files Changed

| File | Change |
|---|---|
| `src/hooks/useSalesContacts.ts` | Add `.limit(5000)` and `.order()` to contacts + v_customers_clean queries |

