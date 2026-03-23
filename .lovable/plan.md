

## Phase 3 — Provider Subsystem Hardening

### Objective

Make the provider system production-grade: health monitoring, circuit breakers, cost tracking, and budget guardrails. All flag-gated, no behavior change until activation.

---

### What Exists (Phase 1 + 2 Complete)

- Provider interface + adapters (not wired into callAI yet)
- `ai_execution_log` with telemetry
- `llm_provider_configs` + `llm_routing_policy` tables
- `policyRouter.ts` with 60s cache
- Shadow + canary flags wired in `callAI()`
- `ai-health` endpoint (manual ping)
- 24 files with direct provider `fetch` calls (bypassing aiRouter)

---

### Task 1 — Health Monitoring (Scheduled + Cache)

**Migration**: Add `provider_status` column to `llm_provider_configs`:
```sql
ALTER TABLE public.llm_provider_configs 
  ADD COLUMN last_health_check timestamptz,
  ADD COLUMN is_healthy boolean DEFAULT true,
  ADD COLUMN last_latency_ms int;
```

**New file**: `supabase/functions/ai-health-cron/index.ts`
- Scheduled edge function (every 5 minutes via pg_cron)
- Pings OpenAI + Gemini using adapter `health()` methods
- Updates `llm_provider_configs.is_healthy`, `last_health_check`, `last_latency_ms`
- Auth: service-role only (cron invocation)

**Edit**: `policyRouter.ts` — skip unhealthy providers during policy resolution by joining `llm_provider_configs.is_healthy` check.

---

### Task 2 — Circuit Breaker

**New file**: `supabase/functions/_shared/providers/circuitBreaker.ts`

In-memory circuit breaker per provider:
- Tracks consecutive failures and error rate over 5-minute window
- States: `closed` (normal) → `open` (blocked) → `half-open` (test)
- Trips on: 5 consecutive failures OR >20% error rate in 5 min
- Half-open: allows 1 test request after 60s cooldown
- Auto-recovers on successful test

**Edit**: `aiRouter.ts` — before calling `_callAISingle`, check circuit breaker state. If open, skip to fallback. Gate behind `ENABLE_CIRCUIT_BREAKER` flag.

---

### Task 3 — Cost Tracking

**Migration**: Create `llm_provider_pricing` table:
```sql
CREATE TABLE public.llm_provider_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  model text NOT NULL,
  prompt_cost_per_1m numeric NOT NULL,
  completion_cost_per_1m numeric NOT NULL,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(provider, model)
);
```
Seed with current pricing from adapters.

**Edit**: `_logExecution()` in `aiRouter.ts` — after logging tokens, look up pricing and add `estimated_cost_usd` to the `ai_execution_log` entry.

**Migration**: Add `estimated_cost_usd numeric` column to `ai_execution_log`.

---

### Task 4 — Budget Guardrails (Soft)

**Migration**: Create `llm_company_budget` table:
```sql
CREATE TABLE public.llm_company_budget (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL UNIQUE,
  monthly_budget_usd numeric DEFAULT 100,
  alert_threshold_pct numeric DEFAULT 80,
  created_at timestamptz DEFAULT now()
);
```

**Edit**: `callAI()` — if `ENABLE_BUDGET_GUARDRAILS` is set, query current month spend from `ai_execution_log` (aggregated). If over budget, log warning but continue. No hard blocking.

---

### Task 5 — Rollout Registry Updates

Add 3 new entries:
- `enable_circuit_breaker` — phase: off
- `enable_cost_tracking` — phase: off
- `enable_budget_guardrails` — phase: off

---

### Files Summary

| File | Action | Category |
|---|---|---|
| Migration SQL | Add columns to `llm_provider_configs`, create `llm_provider_pricing` + `llm_company_budget`, add column to `ai_execution_log` | Schema additive |
| `supabase/functions/ai-health-cron/index.ts` | New — scheduled health checker | Safe additive |
| `supabase/functions/_shared/providers/circuitBreaker.ts` | New — in-memory circuit breaker | Safe additive |
| `supabase/functions/_shared/providers/policyRouter.ts` | Skip unhealthy providers | Safe edit |
| `supabase/functions/_shared/aiRouter.ts` | Circuit breaker check + cost tracking in telemetry | Safe additive (flag-gated) |
| `src/lib/rolloutRegistry.ts` | Add 3 new flag entries | Safe additive |

### What is NOT Changed

- No direct provider call migration yet (too many files, separate wave)
- No hard budget blocking
- No billing UI
- No business logic changes
- `selectModel()` remains as fallback

### Rollback

- Disable `ENABLE_CIRCUIT_BREAKER`, `ENABLE_COST_TRACKING`, `ENABLE_BUDGET_GUARDRAILS`
- System reverts to Phase 2 behavior instantly
- Drop new tables/columns if needed (no dependencies)

