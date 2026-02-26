

# Rebar ERP Automated Testing Suite -- IMPLEMENTED ✅

## Current State (Updated 2026-02-26)

- **Testing infrastructure**: Vitest + jsdom + Deno test runner
- **Test files**: 6 Vitest test files + 2 Deno test files = ~80 test cases
- **MCP API tests**: 18/18 passing ✅ (all 12 MCP tools verified)
- **Autopilot engine tests**: 3/3 passing ✅
- **Bug found & fixed**: `vizzyContext.ts` used `in_transit` → fixed to `in-transit`
- **No E2E framework**: Lovable project constraint; using static analysis + API tests instead

## What We Can Actually Build

Given Lovable's runtime constraints (no headless browser, no Playwright execution), the practical testing suite is:

1. **Unit tests** (Vitest) -- hook logic, data transforms, validation functions
2. **API integration tests** (Deno tests) -- MCP server endpoint verification against live DB
3. **Component render tests** (Vitest + Testing Library) -- render checks, prop validation

We will NOT generate Playwright specs that can't execute. Instead, we produce a practical, runnable suite.

---

## Artifact A -- Test Plan

### Module Coverage Map

| Module | Hook/Service | Unit Tests | API Tests (MCP) | Key Risks |
|--------|-------------|------------|-----------------|-----------|
| Dashboard | `useCEODashboard` | company_id scoping, metric computation | `get_dashboard_stats` | Cross-tenant aggregation |
| Customers | MCP `list_customers` | -- | Filter, limit, empty set | Duplicate creation |
| Leads/CRM | MCP `list_leads` | -- | Stage filter, limit | Invalid stage transitions |
| Orders | `useOrders` | company_id gating, QB payload | `list_orders` status filter | Status string mismatch |
| Deliveries | `useDeliveryActions` | Auto-complete logic | `list_deliveries` status filter | `in-transit` vs `in_transit` |
| Production | `useCutPlans`, slot tracker | `buildSlots`, `recordStroke` | `list_production_tasks` phase filter | Concurrent `completed_pieces` |
| Machines | MCP `list_machines` | -- | Status filter | Down machine + active job |
| Time Entries | `useTimeClock` | Clock-in/out logic | `list_time_entries` | Overlapping entries, no company_id |
| Social Posts | `useSocialPosts` | CRUD mutations | `list_social_posts` platform/status | No company_id column |

### Critical Assertions Per Module

- **Dashboard**: All 18+ queries include `.eq("company_id", companyId)` except `social_posts` and `time_clock_entries` (known schema limitation)
- **Orders**: `sendToQuickBooks` payload includes `companyId`; order query has `enabled: !!companyId`
- **Deliveries**: Status values use `in-transit` (hyphenated); `completed_with_issues` recognized in filters and statusColors
- **Production**: Slot tracker partial bar detection; stroke count uses `Math.max` across all slots
- **Realtime**: All 21 channels use dynamic names scoped by `companyId`, `userId`, or instance ID

---

## Artifact B -- Test Specs to Create

### 1. MCP Server API Tests (Deno)

**File**: `supabase/functions/mcp-server/mcp_api_test.ts`

Tests each MCP tool endpoint against the live test DB:
- `get_dashboard_stats` returns valid counts (all >= 0)
- `list_customers` with limit=5 returns <= 5 rows
- `list_leads` with `stage=won` returns only won leads
- `list_orders` with `status=active` returns only active orders
- `list_deliveries` with `status=in-transit` returns results (not 0 -- validates hyphen fix)
- `list_production_tasks` with `phase=queued` returns only queued items
- `list_machines` with `status=idle` returns only idle machines
- `list_time_entries` returns entries ordered by clock_in desc
- `list_social_posts` with `platform=instagram` returns only instagram posts
- Invalid/missing params return graceful errors, not crashes

### 2. CEO Dashboard Scoping Tests (Vitest)

**File**: `src/hooks/__tests__/useCEODashboard.test.ts`

Unit tests that verify the hook's query-building logic:
- Test that all query builders include `company_id` filter (static analysis of the source)
- Test metric computation (production progress = completedPieces/totalPieces)
- Test QC metric aggregation logic
- Test alert generation thresholds

### 3. Orders Hook Tests (Vitest)

**File**: `src/hooks/__tests__/useOrders.test.ts`

- `sendToQuickBooks` includes `companyId` in payload (mock supabase.functions.invoke)
- Order query is disabled when `companyId` is null
- Order interface types match expected shape

### 4. Delivery Status Consistency Tests (Vitest)

**File**: `src/hooks/__tests__/deliveryStatus.test.ts`

- Status string constants use `in-transit` not `in_transit`
- `completed_with_issues` is a valid status
- Auto-complete logic: all stops terminal -> delivery marked complete
- Auto-complete logic: any failed stop -> `completed_with_issues`

### 5. Realtime Channel Scoping Tests (Vitest)

**File**: `src/hooks/__tests__/realtimeScoping.test.ts`

Static analysis test that reads source files and asserts:
- No realtime `.channel("static-string")` calls without dynamic scoping
- All 21 channels use template literals with `companyId`, `userId`, or unique ID

### 6. Slot Tracker Tests (already exists, extend)

**File**: `src/test/slotTracker.test.ts` -- already comprehensive, no changes needed

---

## Artifact C -- Bug & Regression Schemas

### Bug Record Schema
```json
{
  "bug_id": "string (hash of module+title+endpoint)",
  "title": "string",
  "module": "dashboard|orders|deliveries|production|machines|timeclock|social|crm",
  "severity": "S0|S1|S2|S3",
  "priority": "P0|P1|P2|P3",
  "type": "UI|API|Data|Permissions|Performance|Reliability",
  "steps_to_repro": ["string"],
  "expected": "string",
  "actual": "string",
  "suspected_root_cause": "string",
  "first_seen_run_id": "string",
  "last_seen_run_id": "string",
  "status": "new|known|regression|fixed"
}
```

### Regression Ledger Schema
```json
{
  "test_id": "MOD-001-dashboard_stats",
  "module": "string",
  "scenario_name": "string",
  "last_10_runs": [{"pass": true, "timestamp": "ISO8601"}],
  "flakiness_score": 0.0,
  "linked_bugs": ["bug_id"],
  "last_passed": "ISO8601",
  "last_failed": "ISO8601|null"
}
```

---

## Artifact D -- CI & Execution Notes

- **Run unit tests**: `npm run test` (Vitest, already configured)
- **Run MCP API tests**: `npx supabase functions test mcp-server` (Deno test runner)
- **Environment**: Tests use test environment DB (isolated from production)
- **Gating**: All S0/S1 failures block publish; S2/S3 are warnings
- **Smoke subset**: MCP `get_dashboard_stats` + `list_orders` + `list_deliveries` (3 calls, <5s)

---

## Implementation Steps

1. Create `src/hooks/__tests__/useCEODashboard.test.ts` -- static analysis of company_id scoping + metric math
2. Create `src/hooks/__tests__/useOrders.test.ts` -- QB payload verification + query gating
3. Create `src/hooks/__tests__/deliveryStatus.test.ts` -- status string consistency + auto-complete logic
4. Create `src/hooks/__tests__/realtimeScoping.test.ts` -- verify all 21 channels are dynamically scoped
5. Create `supabase/functions/mcp-server/mcp_api_test.ts` -- API integration tests for all 12 MCP tools
6. Create `src/test/schemas/bugRecord.schema.json` and `regressionLedger.schema.json`
7. Run all tests to establish baseline

This gives approximately 60-80 test cases across 6 files, covering the 9 modules with both unit and API verification layers.

