

# Complete Production Data Reset — Database Cleanup

## What This Does

Deletes ALL transactional production data from the pipeline (AI Extract → Barlists → Cut Plans → Production → Delivery → Packing Slips) so the system starts fresh. No application code changes needed.

## Scope of Deletion

Based on the database analysis, the following tables will be cleared in dependency order (leaf tables first to respect foreign keys):

### Tier 1 — Deepest children (no dependents)
- `delivery_bundles` — delivery bundle records
- `delivery_stops` — delivery stop records  
- `clearance_evidence` — QA clearance photos/evidence
- `inventory_scrap` — scrap records from machine runs
- `extract_errors` — AI extract error logs

### Tier 2 — Mid-level children
- `packing_slips` — packing slip documents
- `loading_checklist` — loading checklist items
- `loading_evidence` — loading photos/evidence
- `cut_output_batches` — cut output batch records
- `inventory_reservations` — inventory reservation records
- `machine_queue_items` — machine queue entries

### Tier 3 — Core production tables
- `production_tasks` — production task records (341 rows)
- `machine_runs` — machine run history (652 rows)
- `deliveries` — delivery records

### Tier 4 — Planning tables
- `cut_plan_items` — individual items in cut plans (405 rows)
- `cut_plans` — cut plan headers (37 rows)

### Tier 5 — Source data
- `barlist_items` — barlist line items (394 rows)
- `barlists` — barlist headers (40 rows)

### Tier 6 — Extract pipeline
- `extract_rows` — extracted data rows
- `extract_raw_files` — uploaded raw files
- `extract_errors` (already cleared in Tier 1)
- `optimization_snapshots` — optimization snapshot data
- `extract_sessions` — AI extract sessions (88 rows)

### Tier 7 — Related operational
- `work_orders` — work order headers (78 rows)
- `purchasing_list_items` — purchasing items
- `camera_events` — camera event links (SET NULL on work_order, safe)

## What is NOT deleted
- `customers` / `companies` / `contacts` — customer master data
- `leads` / `quotes` — CRM/sales data
- `orders` — order records (have RESTRICT FK to customers)
- `projects` — project records
- `profiles` / `user_roles` — user accounts
- `machines` — machine definitions (current_run_id will be set to NULL)
- All chat, activity, AI logs, email data
- All configuration/reference tables

## Safety

- A migration will be created with DELETE statements in correct dependency order
- `machines.current_run_id` will be SET NULL before deleting machine_runs
- Foreign keys with `SET NULL` or `CASCADE` delete actions are handled automatically
- No TRUNCATE needed — sequential DELETE FROM is safer and respects RLS/triggers

## Technical Details

One database migration with ~20 DELETE statements executed in the correct order. The migration will use a transaction block to ensure atomicity — if any step fails, nothing is deleted.

| Action | Detail |
|--------|--------|
| Migration | Sequential DELETE FROM statements in FK dependency order |
| Tables affected | ~20 transactional/production tables |
| Rows to delete | ~2,000+ across all tables |
| Code changes | None |

