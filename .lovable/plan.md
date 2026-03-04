

# Audit: Your Script vs Current Database

All three tables and the view from your script **already exist** from the migration I applied earlier. Here's a detailed comparison:

## Already Done (No Action Needed)

| Item | Status | Notes |
|------|--------|-------|
| `norm_text()` function | Exists | Already created |
| `companies` table | Exists | Same schema (has `company_id` for multi-tenant scoping, which your script lacks) |
| `scopes_of_work` table | Exists | Same schema |
| `entity_links` table | Exists | Has `message_id` column (your script splits into `chat_message_id` + `chat_thread_message_id`) |
| `v_deliveries_enriched` view | Exists | Same join path |

## Two Differences Worth Noting

### 1. `companies` table is empty (0 rows)
Your script includes a seed step that populates `companies` from existing `customers` rows. The previous migration created the table but did **not** seed it. I can run the seed query to populate it.

### 2. `entity_links` column naming
Current table has a single `message_id` column. Your script proposes two separate FK columns (`chat_message_id` and `chat_thread_message_id`). The current design is simpler but less explicit about which message table is referenced. This is a minor structural difference — the current single-column approach works fine with the existing codebase.

## Proposed Action

1. **Seed the `companies` table** from existing clean customer records (INSERT only, no schema changes)
2. **Skip everything else** — already applied and working

No views or frontend code need to change.

