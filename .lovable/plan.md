

## Phase 2 — Policy-Driven Routing (Shadow + Canary)

### Objective

Replace hardcoded `selectModel()` logic with config-driven routing policies. Shadow mode first — log what the policy engine *would* choose vs what actually runs. No behavior change until canary activation.

---

### What Exists (Phase 1 Complete)

- `selectModel()` — hardcoded if/else routing by agent/message pattern
- `_logExecution()` — flag-gated telemetry to `ai_execution_log`
- Provider adapters (not wired yet)
- `ENABLE_AI_OBSERVABILITY` flag

### What Phase 2 Adds

---

### Task 1 — Routing Policy Tables (Migration)

Two new tables:

```sql
-- Provider configs: which providers are available and their current status
CREATE TABLE public.llm_provider_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL UNIQUE,        -- 'gpt' | 'gemini'
  display_name text NOT NULL,
  is_enabled boolean DEFAULT true,
  priority int DEFAULT 10,              -- lower = preferred
  max_rpm int,                          -- rate limit hint
  notes text,
  updated_at timestamptz DEFAULT now()
);

-- Routing policies: map agent/pattern → provider/model
CREATE TABLE public.llm_routing_policy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name text,                      -- null = default/wildcard
  message_pattern text,                 -- regex pattern or null
  has_attachments boolean,              -- null = don't care
  provider text NOT NULL,
  model text NOT NULL,
  max_tokens int DEFAULT 4000,
  temperature numeric DEFAULT 0.5,
  priority int DEFAULT 100,             -- lower = higher priority, first match wins
  is_active boolean DEFAULT true,
  reason text,
  created_at timestamptz DEFAULT now()
);
```

Seed with current `selectModel()` rules:
- estimation+attachments → gemini-2.5-pro (priority 10)
- briefing/daily/report pattern → gemini-2.5-pro (priority 20)
- accounting/legal/empire/commander/data → gemini-2.5-pro (priority 30)
- default wildcard → gemini-2.5-flash (priority 999)

RLS: authenticated SELECT, service-role full access.

---

### Task 2 — Policy Routing Engine (`_shared/providers/policyRouter.ts`)

New file. Pure function:

```typescript
export async function resolvePolicy(agent, message, hasAttachments): Promise<{
  provider, model, maxTokens, temperature, reason, source: "policy" | "fallback"
}>
```

- Fetches `llm_routing_policy` (active, ordered by priority)
- Matches first rule where agent/pattern/attachments match
- Falls back to `selectModel()` if no match or fetch fails
- Returns `source: "policy"` or `source: "fallback"`

Cached in-memory for 60s to avoid per-call DB reads.

---

### Task 3 — Shadow Comparison in `aiRouter.ts`

In `callAI()`, after the existing `selectModel()` call (which callers use externally):

- If `ENABLE_POLICY_ROUTER_SHADOW` is set:
  - Call `resolvePolicy()` 
  - Compare `recommended_provider/model` vs `actual_provider/model`
  - Log mismatch to `ai_execution_log` with `execution_path: "shadow-mismatch"` or `"shadow-match"`
  - **Do NOT override actual provider** — shadow only

This reuses the existing `_logExecution` infrastructure from Phase 1.

---

### Task 4 — Canary Flag (`use_policy_router`)

A separate flag for actual activation (Phase 2 canary, not shadow):

- When `USE_POLICY_ROUTER` is enabled: `callAI()` uses `resolvePolicy()` output instead of the caller-provided provider/model
- When disabled: existing behavior unchanged
- Initial rollout: super admins only → gradual percentage

Not activated in this deployment — just wired. Activation requires validation of shadow data.

---

### Task 5 — Rollout Registry Updates

Add two entries:
- `enable_policy_router_shadow` — phase: off
- `use_policy_router` — phase: off

---

### Files Summary

| File | Action | Category |
|---|---|---|
| Migration SQL | Create `llm_provider_configs` + `llm_routing_policy` + seed data | Schema additive |
| `supabase/functions/_shared/providers/policyRouter.ts` | New — policy resolution engine | Safe additive |
| `supabase/functions/_shared/aiRouter.ts` | Add shadow comparison block in `callAI()` (flag-gated) | Safe additive |
| `src/lib/rolloutRegistry.ts` | Add 2 new flag entries | Safe additive |

### What is NOT Changed

- `selectModel()` remains — it's the fallback and current behavior
- No provider adapter wiring yet
- No circuit breakers
- No cost tracking
- No business logic changes
- No existing edge function changes

### Rollback

- Disable `ENABLE_POLICY_ROUTER_SHADOW` and `USE_POLICY_ROUTER` env vars
- System reverts to hardcoded `selectModel()` instantly
- Drop tables if needed (no dependencies)

