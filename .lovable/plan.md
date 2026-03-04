

# Review of Your Mega Patch SQL

I've audited your script against the current live database state. Here's what's already in place vs what would be new, and the conflicts that need resolving.

## Current State

| Item | Status |
|------|--------|
| `normalized_name` column on `customers` | Already exists |
| `archived` column on `customers` | Does NOT exist |
| `v_customers_clean` view | Exists — filters by `status <> 'archived'`, uses `id`, `name` columns |
| `v_customer_company_map` view | Exists — uses `status NOT IN ('archived')` + `merged_into_customer_id IS NULL` |
| `v_orders_enriched` view | Exists |
| `v_leads_enriched` view | Exists |
| `contacts` table | Exists — but has different schema (uses `customer_id`, `first_name`, `last_name`; no `company_id` ref to a `companies` table) |
| `projects` table | Exists — likely different schema |
| `chat_threads` + `chat_thread_messages` + `chat_thread_links` | All exist (created in earlier migration) |
| `companies` table | Does NOT exist |
| `scopes_of_work` table | Does NOT exist |
| `chat_messages` table | Exists (different from `chat_thread_messages`) |
| `entity_links` table | Does NOT exist |

## Conflicts & Risks

### 1. `contacts` table collision (CRITICAL)
Your script does `CREATE TABLE IF NOT EXISTS public.contacts` with columns `company_id → companies(id)`, `full_name`, `normalized_email`. The existing `contacts` table has `customer_id`, `first_name`, `last_name`, `company_id → companies` (which doesn't exist yet). This `IF NOT EXISTS` will silently skip creation, leaving you with the old schema that doesn't match your new `companies` FK.

### 2. `projects` table collision
Same issue — `projects` already exists with a different schema. Your version references `companies(id)` which doesn't exist yet.

### 3. `v_customers_clean` view would REGRESS
Your script replaces the current view (which exposes `id`, `name`, `email`, `phone`, `quickbooks_id`, and 15+ columns) with a much narrower view (only `customer_id`, `display_name`, `company_name`, `normalized_name`, `status`, `payment_terms`, `created_at`). This would break every frontend query that reads `id`, `name`, `email`, `phone`, `quickbooks_id` etc.

### 4. `archived` boolean vs `status` column
The current system uses the `status` column (`'active'`, `'archived'`, `'archived_odoo_only'`) for archiving. Your script adds a separate `archived` boolean and filters on that. The existing frontend code and views all use `status` — switching to `archived` would require updating every query.

### 5. `chat_threads` / `chat_messages` naming collision
`chat_threads` already exists with different columns (has `created_by`, `customer_id` refs). `chat_messages` is new but overlaps conceptually with `chat_thread_messages`.

## Recommendation

Running this script as-is would break the frontend (view column regression) and create schema conflicts with existing tables. Here's what I recommend instead:

### Safe to adopt now
- **`companies` table** — new, no conflicts. Good foundation for future hierarchy.
- **`scopes_of_work` table** — new, depends on `companies` + `projects` (needs projects FK resolved).
- **`entity_links` table** — new universal link table, complements existing `chat_thread_links`.
- **`v_deliveries_enriched` view** — new, useful addition.

### Needs adaptation
- **`v_customers_clean`** — keep the current wide-column version, don't replace with the narrow one.
- **`contacts`** — needs an `ALTER TABLE ADD COLUMN` migration instead of `CREATE TABLE`, to add any missing columns without destroying existing data.
- **`projects`** — same, needs column additions not recreation.
- **Archive logic** — continue using `status` column, don't add `archived` boolean.

### Should skip
- The `UPDATE customers SET archived = true` at the end — would set a column that nothing reads and the column doesn't exist yet.

Shall I create an adapted migration that cherry-picks the safe new pieces (`companies`, `scopes_of_work`, `entity_links`, `v_deliveries_enriched`) while preserving the existing working views and table schemas?

