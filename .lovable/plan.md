

# Generate system-rebuild-blueprint-v2.md — Final Clean Specification

## What
Convert the existing v2 blueprint into a FINAL, CLEAN, PRODUCTION-READY specification document with zero duplication, zero narrative, and pure execution-ready SQL/JSON/code.

## Data Confirmed
- **274 tables** with full column schemas (name, type, nullable, defaults)
- **780 RLS policies** with full SQL conditions (qual + with_check)
- **283 database functions** with full CREATE OR REPLACE definitions
- **~80 triggers** with timing, event, and function mappings
- **~500 indexes** with full CREATE INDEX statements
- **1 enum**: `app_role` (admin, sales, accounting, office, workshop, field, shop_supervisor, customer)
- **9 extensions**: pg_cron, pg_graphql, pg_net, pg_stat_statements, pgcrypto, uuid-ossp, vector, supabase_vault
- **10 views**: contacts_safe, events, profiles_safe, user_meta_tokens_safe, v_communications_enriched, v_customer_company_map, v_customers_clean, v_deliveries_enriched, v_leads_enriched, v_orders_enriched
- **193 edge functions** with auth modes and handler options
- **21 agent prompts** — full system prompt text extracted
- **Key functions**: has_role, has_any_role, get_user_company_id, handle_new_user, auto_advance_item_phase, block_delivery_without_qc, block_approved_without_price
- **requestHandler.ts** — full wrapper pattern with authMode, requireCompany, wrapResult, rawResponse, parseBody options
- **aiRouter.ts** — dual-provider GPT/Gemini with circuit breaker, policy router, shadow logging

## Output Structure
A single Python script generates `/mnt/documents/system-rebuild-blueprint-v2.md` with these sections ONLY:

### 1. DATABASE (FULL DDL)
- Extensions
- Enum definitions
- CREATE TABLE for all 274 tables (columns, types, defaults, nullable, PKs)
- Foreign keys, unique constraints
- All indexes
- All triggers with function references

### 2. DATABASE FUNCTIONS
- All 283 functions with full CREATE OR REPLACE SQL

### 3. RLS POLICIES
- ALTER TABLE ... ENABLE ROW LEVEL SECURITY for every table
- All 780 policies with full SQL (cmd, qual, with_check, roles)

### 4. VIEWS
- All 10 view definitions

### 5. EDGE FUNCTIONS (API CONTRACTS)
- All 193 functions grouped by domain
- Route, method, auth mode, handler options
- Request/response schemas where determinable from code

### 6. AGENT SYSTEM
- All 21 agents with full system prompts (exact text from code)
- Tool definitions per agent

### 7. AI ROUTER
- Provider config, fallback logic, circuit breaker rules, policy router

### 8. INTEGRATIONS
- QuickBooks, RingCentral, Gmail, Meta/Facebook, LinkedIn, ElevenLabs, WordPress
- Auth flows, sync patterns

### 9. STATE MACHINES / WORKFLOWS
- Order lifecycle, lead pipeline stages, delivery states, production phases
- Trigger-enforced transitions

### 10. REALTIME
- Tables with realtime enabled, channel patterns

## Approach
- Python script using psql queries to dump full DDL inline
- All agent prompts embedded verbatim from source files
- Edge function metadata compiled from directory listing + index.ts patterns
- Document split into parts if > 1MB
- Zero narrative, zero duplication, zero "best practice" language

## Impact
- 0 codebase files changed
- 1 comprehensive specification artifact generated

