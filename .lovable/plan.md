

## Surgical Patch: Sales Agent Cage Quote Bug

### Problem
When the LLM generates a cage quote, it sometimes emits `"cages": "cages"` (a string) instead of `"cages": [...]` (an array). This causes `normalizeScope` in `quoteCalcEngine.ts` to return an empty array (silently dropping the cage data), and in `agentToolExecutor.ts` the `Array.isArray` check also silently drops it. The result is a $0 quote reported as "successful."

Additionally, there's no quote-recovery conversation flow — after a $0 or failed quote, the agent doesn't prompt the user to provide missing details.

### Changes (3 files, surgical)

**1. `supabase/functions/_shared/agentToolExecutor.ts` (~line 270-302)**
- Add cage input normalization before the `Array.isArray` checks:
  - If `scope.cages` is a string, attempt `JSON.parse`; if that fails or returns non-array, set to `[]` and log a warning
  - If `scope.cages` is a plain object (not array), wrap it as `[scope.cages]`
- After the quote-engine response (line 297-302), add $0 quote interception:
  - If `result.success === true` but `grand_total <= 0` and there were line items in the request, override `result.success = false` and add `result.quote_recovery = true` with a message listing what's missing
  - This prevents the agent from reporting a $0 quote as successful

**2. `supabase/functions/_shared/quoteCalcEngine.ts` (~line 359-392)**
- In `normalizeScope`, add a `normalizeCageArray` step before `coerceLines`:
  - If `scope.cages` is a string → try `JSON.parse`, fall back to `[]`
  - If it's a non-null object but not an array → wrap as `[scope.cages]`
  - Validate each cage object has `total_cage_weight_kg` — if missing/zero, flag it
- In `validateEstimateRequest` (~line 462), add checks for required cage fabrication fields (`tie_bar_size`, `tie_quantity`, `vertical_bar_size`, `vertical_quantity`) — return validation questions instead of silently accepting incomplete data

**3. `supabase/functions/_shared/agents/sales.ts` (~line 195-232)**
- Add a "Quote Recovery Mode" instruction block to the Blitz prompt:
  - When a quote returns `pricing_failed`, `grand_total_zero`, or `quote_recovery: true`, Blitz must NOT say the quote succeeded
  - Instead, list the specific missing inputs from the engine's response and ask the user to provide them
  - Preserve the original scope in the conversation so the user only needs to fill gaps, not re-specify everything
  - Example: "I couldn't price the cages because `total_cage_weight_kg` is missing. Can you provide the estimated weight per cage?"

### What is NOT changed
- No schema changes, no new tables, no UI changes
- `quote-engine/index.ts` already has $0 guard — no changes needed there
- No changes to other agents or shared modules

