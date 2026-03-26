

# Investigate Sales Agent Error — Actual Root Cause Analysis

## Finding: The stated root cause is **incorrect**

After thorough investigation, the model `gpt-4-1106-preview` does **not exist anywhere** in this codebase. The `ai-agent` edge function routes the sales agent to `gemini-2.5-flash` by default (via `selectModel` in `aiRouter.ts`). All OpenAI references use current models (`gpt-4o`, `gpt-4o-mini`, `gpt-5`).

The error "Edge Function returned a non-2xx status code" is a **generic Supabase SDK wrapper** — it doesn't indicate which model failed. The real failure could be:

1. **Quote-engine returning 404** — no active pricing config for the user's company
2. **Timeout** — the ai-agent has a complex tool execution loop (quote generation) that may exceed the 60s edge function wall clock
3. **Gemini API rate limit or transient failure** — retries exhausted
4. **Auth or company resolution issue** — intermittent

## What I Need

Since there are no recent `sales` agent entries in the edge function logs (all recent logs show `accounting` agent only), I cannot determine the exact cause from server logs alone.

### Proposed diagnostic approach

1. **Add targeted error logging** to the `ai-agent` function specifically around the sales/quote flow to capture the actual HTTP status and error body when it fails
2. **Test the quote-engine** directly with sample cage data to see if it returns a proper response or a 404/500
3. **Check `quote_pricing_configs` table** — if no active config exists for the user's company, the quote-engine returns 404, which bubbles up as a non-2xx error

### Immediate safe fix

Add better error surfacing so that instead of "Edge Function returned a non-2xx status code", the user sees the **actual error message** (e.g., "No pricing config found" or "Quote engine timeout"). This is done by checking if the `ai-agent`'s `handleRequest` properly catches and returns descriptive error messages for quote-engine failures.

## Files to investigate/change
- `supabase/functions/ai-agent/index.ts` — verify error propagation from tool execution
- `supabase/functions/_shared/agentToolExecutor.ts` — check quote-engine error handling (~line 497-510)
- Database: `quote_pricing_configs` table — verify active config exists

## Shall I proceed with the diagnostic (check DB for pricing config, improve error messages), or would you like to try reproducing the error first so I can capture the actual logs?

