

# Plan: Generate system-rebuild-blueprint-v2.md

## What
Generate a comprehensive v2 blueprint document by extending the existing v1 with 10 additional deep-technical layers, using all data gathered from the live codebase and database.

## Data Gathered
- **284 tables** — full column definitions (name, type, nullable, defaults) from `security--get_table_schema`
- **780 RLS policies** — full SQL conditions from `pg_policies`
- **~500 indexes** — full CREATE INDEX statements from `pg_indexes`
- **~80 triggers** — table-to-function mappings from `pg_trigger`
- **~50 database functions** — full SQL source (has_role, has_any_role, get_user_company_id, all trigger functions, scoring, DM creation, rate limiting, etc.)
- **1 enum**: `app_role` (admin, sales, accounting, office, workshop, field, shop_supervisor, customer)
- **193 edge functions** — full directory listing with auth modes from index.ts files
- **9 agent prompt files** — sales (Blitz), accounting (Penny), operations (Forge), and 6 more
- **AI Router** — dual-provider GPT/Gemini with circuit breaker, policy router, shadow logging
- **Views**: v_customers_clean, v_customer_company_map, v_communications_enriched, v_deliveries_enriched, v_leads_enriched, v_orders_enriched, contacts_safe, profiles_safe, user_meta_tokens_safe, events

## Output
A single Python script will generate `/mnt/documents/system-rebuild-blueprint-v2.md` containing all 30 original sections PLUS the 10 new deep-technical sections:

### New Sections Added
1. **Full Database DDL** — CREATE TABLE for all 284 tables, all columns with types/defaults/nullability, PKs, FKs, indexes, unique constraints, enum definitions, trigger functions (full SQL), RLS policies (full SQL), helper functions (has_role, has_any_role, get_user_company_id)
2. **Complete API Spec** — All 193 edge functions grouped by domain, with method, auth mode, request/response schemas, side effects
3. **Agent System Full Prompt Layer** — All 21 agents with full system prompts, role definitions, tool usage rules, escalation protocols
4. **Business Logic Zero Ambiguity** — Trigger-enforced rules (block_approved_without_price, block_delivery_without_qc, auto_advance_item_phase, etc.) as deterministic if/else logic
5. **Data Models Full Field Level** — Every entity field with type, meaning, example value
6. **Sample Data** — Realistic records for leads, customers, work_orders, quotes, machine_runs, notifications
7. **UI → Data Binding** — Pages mapped to tables and edge functions they call
8. **State + Event Flow** — Action → trigger → side-effect chains
9. **Integration Contracts** — QuickBooks, RingCentral, Gmail, Meta, ElevenLabs auth methods and sync logic
10. **All Generic Language Removed** — No "best practice", "typically", "may", "could"

### Approach
- Python script writes the markdown programmatically using all gathered data
- The document will be split into logical parts if it exceeds reasonable size
- Every table, function, trigger, policy, and edge function is included with actual SQL/code
- Estimated output: 500KB-1MB of structured Markdown

### Impact
- 0 codebase files changed
- 1 comprehensive artifact generated at `/mnt/documents/system-rebuild-blueprint-v2.md`

