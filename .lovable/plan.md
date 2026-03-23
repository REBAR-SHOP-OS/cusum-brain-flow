

## AI Health Check — Plan

### Secrets Status (Verified from Prod)

| Secret | Present |
|---|---|
| `GPT_API_KEY` | **true** |
| `GEMINI_API_KEY` | **true** |
| `LOVABLE_API_KEY` | **true** |
| `OPENAI_API_KEY` | **false** (not needed — `aiRouter.ts` uses `GPT_API_KEY`) |

Note: There is also a `GEMENI_API_KEY` (typo) present — harmless, unused.

### Task 1 — Create `ai-health` Function

**File**: `supabase/functions/ai-health/index.ts` (new)

- Auth-gated via `requireAuth` + super admin email check (from `_shared/accessPolicies.ts`)
- Checks:
  - `env_present`: `{ gpt: bool, gemini: bool, lovable: bool }` — checks `Deno.env.get()` truthiness
  - `openai_ping`: HEAD request to `https://api.openai.com/v1/models` with `GPT_API_KEY` bearer → returns HTTP status + latency
  - `gemini_ping`: HEAD request to Gemini endpoint with key → returns HTTP status + latency
  - `lovable_ping`: POST to `https://ai.gateway.lovable.dev/v1/chat/completions` with minimal payload → returns HTTP status + latency
- No DB writes. No secrets logged.
- Returns JSON with status codes and latencies only.

### Task 2 — Redeploy AI Functions

After creating `ai-health`, deploy it. No other functions need manual redeployment — Lovable auto-deploys all functions on each code change, and secrets are already present in prod.

### Task 3 — Test

Call `ai-health` via `supabase--curl_edge_functions` to get a live result.

### Files

| File | Action | Rollback |
|---|---|---|
| `supabase/functions/ai-health/index.ts` | New | Delete file |

### What is NOT touched
- No business logic
- No database schema
- No existing edge functions
- No aiRouter changes

