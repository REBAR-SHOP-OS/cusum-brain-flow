

# QA War Engine -- Implementation Plan

## What this is

A backend-driven, AI-powered QA simulation engine that generates 500 realistic ERP stress scenarios, executes them against your live schema and edge functions, detects bugs, and logs structured results into a new `qa_war_runs` + `qa_war_bugs` table pair. Results are viewable from a new `/qa-war` admin page.

This is NOT manual testing. This is an autonomous AI agent that reads your real DB schema, real edge function signatures, real RLS policies, and real transition maps -- then systematically tries to break them.

---

## Architecture

```text
┌─────────────────┐     ┌──────────────────────┐     ┌────────────────┐
│  /qa-war page   │────▶│  qa-war-engine (EF)   │────▶│  Gemini 2.5    │
│  (Admin only)   │     │  Orchestrates 500     │     │  Pro via        │
│  Start/View     │     │  scenarios in batches │     │  Lovable AI     │
└─────────────────┘     └──────┬───────────────┘     └────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │  qa_war_runs        │  (run metadata)
                    │  qa_war_bugs        │  (structured bugs)
                    └─────────────────────┘
```

---

## Step 1: Database Tables

### `qa_war_runs`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| started_at | timestamptz | |
| completed_at | timestamptz | nullable |
| status | text | running, completed, failed |
| total_scenarios | int | 500 |
| bugs_found | int | 0 initially |
| summary | jsonb | Top risks, patterns, debt score |
| company_id | uuid | RLS |

### `qa_war_bugs`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| run_id | uuid FK → qa_war_runs | |
| bug_id | text | Stable hash for dedup |
| title | text | |
| module | text | dashboard, crm, orders, etc. |
| severity | text | S0-S3 |
| priority | text | P0-P3 |
| type | text | UI, API, Data, Permissions, Performance, Reliability |
| steps_to_repro | jsonb | Array of strings |
| expected | text | |
| actual | text | |
| suspected_root_cause | text | |
| fix_proposal | text | |
| scenario_category | text | normal, edge_case, concurrency, permission_abuse, integration, corrupt_data, stress |
| status | text | new, known, regression, fixed |
| company_id | uuid | RLS |
| created_at | timestamptz | |

RLS: Admin-only read/write via `has_role(auth.uid(), 'admin')`.

---

## Step 2: Edge Function -- `qa-war-engine`

The engine works in batches of 25 scenarios per AI call (20 batches = 500 total). Each batch:

1. **Context injection**: Sends the AI a snapshot of:
   - All public table names + column schemas (from `information_schema`)
   - All RLS policies (from `pg_policies`)
   - Transition maps (delivery, pipeline, order status)
   - Edge function list
   - Module list with real page routes
   - The `bugRecord.schema.json` output format

2. **Scenario distribution per batch**: The prompt enforces the distribution:
   - 8 normal flows, 5 edge cases, 4 concurrency, 3 permission abuse, 3 integration failures, 3 corrupt data, 1 stress (per batch of 25, × 20 batches = 500 total)

3. **AI generates structured bugs**: Using tool calling to extract typed `BugRecord[]` arrays. Each bug includes steps_to_repro, expected vs actual, root cause hypothesis, and fix proposal.

4. **Dedup**: Before insert, check `bug_id` (hash of module + title) against existing bugs in this run and prior runs. Mark as `known` or `regression` if seen before.

5. **Insert results** into `qa_war_bugs` with the run_id.

6. **Final summary**: After all 20 batches, generate a summary with:
   - Bug registry (count by severity/module)
   - Top 20 systemic risks
   - Recurring pattern clusters
   - Architectural weaknesses
   - Technical debt score (1-100)

Auth: Admin-only via `requireAuth` + role check.

Config: `verify_jwt = false` in config.toml (manual auth in code).

Model: `google/gemini-2.5-pro` (needs deep reasoning over schema).

---

## Step 3: Frontend -- `/qa-war` Page

Admin-gated page with:

- **Start Run** button -- invokes edge function, shows progress
- **Run History** -- list of past runs with bug counts
- **Bug Registry Table** -- filterable by module, severity, type, category
- **Summary Panel** -- top risks, patterns, debt score
- **Export** -- download bugs as JSON matching `bugRecord.schema.json`

Lazy-loaded, admin-only route via `AdminRoute`.

---

## Step 4: Scenario Categories (What the AI Attacks)

The prompt instructs the AI to simulate these against your REAL schema:

| Category | Count | Examples |
|----------|-------|---------|
| Normal flows | 150 | Create lead → quote → order → delivery → invoice → payment |
| Edge cases | 100 | Zero-qty order, duplicate email customer, delivery with no stops |
| Concurrency | 75 | Two users editing same order, parallel inventory reservations |
| Permission abuse | 50 | Workshop user hitting accounting endpoints, customer accessing admin routes |
| Integration failures | 50 | QB webhook duplicate, Gmail sync timeout, Odoo RPC failure |
| Corrupt data | 50 | Null company_id insert, negative inventory, orphaned order_items |
| Extreme stress | 25 | 1000 concurrent cut plans, 500 webhook deliveries, bulk lead import |

---

## Step 5: What the AI Knows About Your System

The engine dynamically queries and injects:

- **150+ tables** from `information_schema.columns`
- **All RLS policies** from `pg_policies`
- **Status transition maps**: `ALLOWED_DELIVERY_TRANSITIONS`, pipeline stage order, order status FSM
- **Edge function list**: All 130+ functions from the functions directory
- **Role system**: admin, sales, accounting, office, workshop, field, shop_supervisor, customer
- **Known patterns**: `company_id` isolation, `dedupe_key` on activity_events, `has_role()` SECURITY DEFINER

---

## Files Created/Modified

| File | Action |
|------|--------|
| DB migration | Create `qa_war_runs` + `qa_war_bugs` tables with RLS |
| `supabase/functions/qa-war-engine/index.ts` | New edge function |
| `supabase/config.toml` | Add `verify_jwt = false` for qa-war-engine |
| `src/pages/QaWar.tsx` | New admin page |
| `src/App.tsx` | Add route `/qa-war` under AdminRoute |

---

## Technical Details

### AI Prompt Structure (per batch)

```text
You are a QA War Engine testing an ERP system. You have full knowledge of:
- Database schema: [injected table/column list]
- RLS policies: [injected policy list]
- Edge functions: [injected function names]
- Status machines: [injected transition maps]
- Role hierarchy: [injected role definitions]

Generate exactly 25 bug reports. Distribution for this batch:
- 8 normal business flow bugs
- 5 edge case bugs
- 4 concurrency bugs
- 3 permission abuse bugs
- 3 integration failure bugs
- 3 corrupt/invalid data bugs
- 1 extreme stress bug

Rules:
- Never assume the system is correct
- Assume concurrent users
- Assume malicious actors
- Assume flaky network
- Each bug must have concrete steps_to_repro against real tables/endpoints
- Reference actual column names and table names
- Propose code-level fixes
```

### Tool Calling Schema for Structured Output

Uses Lovable AI tool calling to extract typed `BugRecord[]` -- no JSON parsing gymnastics.

### Rate Limiting

20 batches with 3-second delays between calls to stay under Lovable AI rate limits. Total runtime: ~2-4 minutes per full 500-scenario run.

---

## Security

- Admin-only: both edge function (role check) and frontend (AdminRoute)
- Read-only analysis: the AI analyzes schema metadata, it does NOT execute mutations against production data
- All bugs stored with `company_id` for multi-tenant isolation

