

## Plan — Fix "Unknown Customer" labels in Production Queue

### Root cause (verified live in DB)

The Production Queue (`/office` → Production Queue tab) resolves customer names through the `public.v_customers_clean` view. That view's WHERE clause filters out any customer whose `name` contains `", "`:

```sql
WHERE status <> 'archived'
  AND merged_into_customer_id IS NULL
  AND POSITION(', ' IN name) = 0   -- ← the offender
```

This filter was intended to hide contact-style entries (e.g. `"John, Doe"`) but it also excludes **legitimate business customers** whose names contain a comma, including:

| Customer ID | Real name (in `customers`) | In view? |
|---|---|---|
| `5f296a62-11da-42dc-afc6-13714954bd8d` | Ontario Parking Systems, Blake | ❌ filtered out |
| `c73cb08b-fec3-4e47-81a3-a91ffaaabcc0` | Powell Fence, Tyler Jones | ❌ filtered out |
| `273778c1-…` | BESTCON FORMING INC. | ✅ shows fine |

`ProductionQueueView.tsx` (line 163) queries `v_customers_clean` for these IDs, gets nothing back, and falls through to the `\`Unknown Customer (${cid.slice(0, 8)})\`` placeholder on line 320.

This is **not** a React-Query staleness bug, and **not** an `/office` company-update bug — those don't exist in this codebase. The actual on-screen "Unknown Customer" labels in the user's screenshot are entirely caused by the view filter.

### Fix — replace the brittle `POSITION(', ')` filter

Change the view to keep all real, non-archived, non-merged customers regardless of comma in name. Contact-style entries should be filtered by a proper signal (e.g., `customer_type`, or a dedicated flag), not by punctuation in the display name.

```sql
CREATE OR REPLACE VIEW public.v_customers_clean
WITH (security_invoker = true) AS
SELECT id AS customer_id, id, name, name AS display_name,
       company_name, normalized_name, phone, email, status, company_id,
       created_at, updated_at, quickbooks_id, customer_type,
       payment_terms, credit_limit, notes,
       merged_into_customer_id, merged_at, merged_by, merge_reason
FROM customers
WHERE status <> 'archived'
  AND merged_into_customer_id IS NULL;
```

Notes:
- Keeps `security_invoker = true` per project view standard.
- Drops only the `POSITION(', ' IN name) = 0` predicate; archived + merged filters preserved.
- No frontend code change. No RLS change. No other tables touched.

### Verification (run after migration)

```sql
SELECT customer_id, display_name
FROM v_customers_clean
WHERE customer_id IN (
  '5f296a62-11da-42dc-afc6-13714954bd8d',
  'c73cb08b-fec3-4e47-81a3-a91ffaaabcc0'
);
-- expect: both rows returned with their real names
```

Then refresh `/office` → Production Queue. The two red-circled "Unknown Customer (…)" entries should display as **"Ontario Parking Systems, Blake"** and **"Powell Fence, Tyler Jones"**, with their projects (`OPS - RF YONDR Data Center`, `Powell Fence DIV 23 Cages`) nested correctly underneath.

### Result

| Surface | Before | After |
|---|---|---|
| Production Queue customer node (5f29…) | "Unknown Customer (5f296a62)" | "Ontario Parking Systems, Blake" |
| Production Queue customer node (c73c…) | "Unknown Customer (c73cb08b)" | "Powell Fence, Tyler Jones" |
| Any other customer with a comma in name | hidden as "Unknown" | resolved correctly |
| BESTCON, Marks Sign Service, ET CONSTRUCTION, etc. | already fine | unchanged |
| Other consumers of `v_customers_clean` | filtered subset | full active set (intended) |

### Out of scope

- No changes to `ProductionQueueView.tsx`, `useCompanies`, `useProjects`, or any frontend file.
- No RLS changes — view is `security_invoker` and `customers` RLS still applies.
- Archived and merged customers remain hidden.
- If a true "no contacts" filter is needed elsewhere, that should be a separate, explicit signal (e.g., `customer_type = 'business'`) — not punctuation in `name`.

### Files touched

None in the repo. **One database migration** that runs `CREATE OR REPLACE VIEW public.v_customers_clean …` as shown above.

