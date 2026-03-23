

## Phase 1 — AI Observability + Provider Abstraction (Shadow Only)

This is a large, multi-layered infrastructure change. Given the project's strict surgical execution mandate, I recommend **scoping Phase 1 down** to what is safe and deliverable without risk.

---

### What Already Exists

- `aiRouter.ts` — centralized `callAI()` / `callAIStream()` with retry, fallback, GPT-5 handling
- `ai_usage_log` table — already logs provider, model, tokens, agent_name, company_id, user_id
- `featureFlags.ts` — `isEnabled()` helper for env-based flags
- `structuredLog.ts` — `createLogger()` for JSON structured logging
- `selectModel()` — hardcoded routing rules by agent/message
- 56 edge functions import `callAI`/`callAIStream`
- 7 functions make direct `fetch` to OpenAI/Gemini (bypassing aiRouter) — these are image generation, realtime tokens, and agent-router

### What Does NOT Exist Yet

- Provider abstraction interface
- Provider adapters
- Execution telemetry (request_id, latency, status, execution_path)
- Shadow routing comparison
- Feature flag gating for observability

---

### Deliverables for Phase 1

#### 1. Provider Interface (`_shared/providers/LLMProvider.ts`)

```text
interface LLMProvider {
  chat(opts): Promise<AIResult>
  health(): Promise<{ ok: boolean; latency_ms: number; status: number }>
  estimateCost(usage): { prompt_cost: number; completion_cost: number; total_cost: number }
}
```

Safe additive — no imports from existing code.

#### 2. Provider Adapters

- `_shared/providers/openaiAdapter.ts` — wraps existing GPT fetch pattern
- `_shared/providers/geminiAdapter.ts` — wraps existing Gemini fetch pattern

Both mirror the exact logic currently in `_callAISingle`. They call the same endpoints with the same headers. They normalize to the same `AIResult` shape. **No routing change** — these are not wired into `callAI()` yet.

#### 3. Telemetry Table: `ai_execution_log`

Migration to create an **append-only** table:

```sql
CREATE TABLE public.ai_execution_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id text NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  agent_name text,
  company_id text,
  user_id uuid,
  status text NOT NULL DEFAULT 'success',  -- success | error | fallback
  http_status int,
  latency_ms int,
  prompt_tokens int DEFAULT 0,
  completion_tokens int DEFAULT 0,
  total_tokens int DEFAULT 0,
  execution_path text,  -- e.g. "primary" | "retry-1" | "fallback"
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

RLS: authenticated SELECT, service-role INSERT. Append-only.

This is **separate from** `ai_usage_log` (which continues unchanged).

#### 4. Instrument `aiRouter.ts` (Shadow Telemetry)

In `callAI()` and `_callAISingle()`:

- Generate a `request_id` per call
- Measure `latency_ms` with `performance.now()`
- Log to `ai_execution_log` fire-and-forget (same pattern as existing `_logUsage`)
- Gate behind `isEnabled("ENABLE_AI_OBSERVABILITY")` — default OFF
- On error/fallback, log `status: "error"` or `status: "fallback"` with `execution_path`

**Zero behavior change** — telemetry is fire-and-forget, flag-gated, and wrapped in try/catch. If it fails, the AI call still succeeds.

#### 5. Update Rollout Registry

Add entries for:
- `enable_ai_observability` — phase: off, status: active

---

### Files to Create

| File | Category |
|---|---|
| `supabase/functions/_shared/providers/LLMProvider.ts` | Safe additive |
| `supabase/functions/_shared/providers/openaiAdapter.ts` | Safe additive |
| `supabase/functions/_shared/providers/geminiAdapter.ts` | Safe additive |
| Migration for `ai_execution_log` table | Schema additive |

### Files to Edit

| File | Change | Category |
|---|---|---|
| `supabase/functions/_shared/aiRouter.ts` | Add flag-gated shadow telemetry in `callAI` + `_callAISingle` | Safe additive (no behavior change) |
| `src/lib/rolloutRegistry.ts` | Add `enable_ai_observability` entry | Safe additive |

### What is NOT Done in Phase 1

- No routing changes (adapters exist but are not wired)
- No policy tables (Phase 2)
- No circuit breakers (Phase 3)
- No cost tracking (Phase 3)
- No removal of direct provider calls (Phase 3)
- No `llm_provider_pricing` table yet (Phase 3)

### Regression Risk

**Minimal** — all new files are additive. The only edit to existing code (`aiRouter.ts`) is flag-gated and fire-and-forget. If `ENABLE_AI_OBSERVABILITY` is not set (default), zero additional code executes.

### Rollback

- Delete the new files
- Remove the telemetry block from `aiRouter.ts`
- Drop `ai_execution_log` table

