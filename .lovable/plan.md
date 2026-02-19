
# Fix: Duplicate Contacts on /customers Page

## Root Cause — Confirmed via Database Analysis

### The Database Problem
The `contacts` table has **no unique constraint** preventing duplicate entries for the same contact under the same customer. Only a primary key index exists. There is no guard on `(customer_id, email)` or `(customer_id, phone)`.

This means the `process-rfq-emails` edge function (which checks for an existing contact but can race) and `import-crm-data` have been inserting new contact rows every time they run for the same customer — resulting in:
- **385 customers** with duplicate contacts
- **10,648 duplicate contact pairs** in live data
- One customer alone has **59 identical contact records**

### The UI Problem
`CustomerDetail.tsx` (line 194–199) queries:
```ts
.from("contacts")
.select("*")
.eq("customer_id", customer.id)
.eq("is_primary", true)
.maybeSingle()   // ← BREAKS silently when multiple rows returned
```
And `Customers.tsx` (line 51–55) queries:
```ts
.from("contacts")
.select("customer_id, phone")
.eq("is_primary", true)   // ← Multiple "primary" contacts exist
.not("phone", "is", null)
```
Since all duplicates have `is_primary = true`, the phone/contact shown per customer is arbitrary and the `.maybeSingle()` may return null if the PostgREST response contains more than one row.

## The Fix — Two-Part, Surgical

### Part 1: Database Migration (SQL only — no schema file edits)
This migration does three things in strict order:

**Step A** — Delete true duplicates (keep the oldest record per customer+email group):
```sql
DELETE FROM contacts
WHERE id NOT IN (
  SELECT DISTINCT ON (customer_id, LOWER(TRIM(email)))
    id
  FROM contacts
  WHERE email IS NOT NULL AND customer_id IS NOT NULL
  ORDER BY customer_id, LOWER(TRIM(email)), created_at ASC
)
AND email IS NOT NULL
AND customer_id IS NOT NULL;
```

**Step B** — For any remaining duplicates sharing the same phone (no email), keep oldest:
```sql
DELETE FROM contacts
WHERE id NOT IN (
  SELECT DISTINCT ON (customer_id, phone)
    id
  FROM contacts
  WHERE phone IS NOT NULL AND email IS NULL AND customer_id IS NOT NULL
  ORDER BY customer_id, phone, created_at ASC
)
AND phone IS NOT NULL AND email IS NULL AND customer_id IS NOT NULL;
```

**Step C** — Add a partial unique index to prevent future email duplicates:
```sql
CREATE UNIQUE INDEX contacts_unique_customer_email
  ON contacts (customer_id, LOWER(TRIM(email)))
  WHERE email IS NOT NULL AND customer_id IS NOT NULL;
```

This index is partial (only where email is not null) so contacts without emails are not constrained.

### Part 2: Frontend Hardening — `src/components/customers/CustomerDetail.tsx` only
Change the `primaryContact` query (lines ~191–201) from `.maybeSingle()` to a safe `.limit(1)` with explicit ordering, so it never silently fails when duplicates exist:

**Before:**
```ts
const { data: primaryContact } = useQuery({
  queryKey: ["primary_contact", customer.id],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("contacts")
      .select("*")
      .eq("customer_id", customer.id)
      .eq("is_primary", true)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
});
```

**After:**
```ts
const { data: primaryContact } = useQuery({
  queryKey: ["primary_contact", customer.id],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("contacts")
      .select("*")
      .eq("customer_id", customer.id)
      .eq("is_primary", true)
      .order("created_at", { ascending: true })
      .limit(1);
    if (error) throw error;
    return data?.[0] ?? null;
  },
});
```

This returns the original/oldest primary contact reliably even if stale duplicates survive the migration.

## Scope

| Layer | Target | Change |
|---|---|---|
| Database migration | `contacts` table | Deduplicate existing rows + add partial unique index on (customer_id, email) |
| Frontend | `src/components/customers/CustomerDetail.tsx` | `.maybeSingle()` → `.order().limit(1)` for primary contact query |

## What Is NOT Changed
- `Customers.tsx` — untouched (the `primaryContacts` query fetches all `is_primary=true` contacts across all customers, but only uses one per `customer_id` via the `phoneMap` — which will correctly pick the first match after deduplication)
- `CustomerTable.tsx` — untouched
- `CustomerFormModal.tsx` — untouched
- `process-rfq-emails` edge function — untouched (the unique index will prevent future duplicates at the DB level)
- All other pages, components, tables — untouched
