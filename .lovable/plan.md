

# LLM Token Usage Dashboard for CEO Portal

## What
Add a new card to the CEO Portal showing total AI/LLM token consumption broken down by 30/60/90 day windows, by provider (GPT vs Gemini), and by agent. This requires: a new logging table, updating the AI router to record usage after each call, and a new dashboard component.

## Database

### New table: `ai_usage_log`
```sql
CREATE TABLE public.ai_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,        -- 'gpt' or 'gemini'
  model text NOT NULL,            -- 'gemini-2.5-flash', 'gpt-4o', etc.
  agent_name text,                -- which agent triggered it
  prompt_tokens int NOT NULL DEFAULT 0,
  completion_tokens int NOT NULL DEFAULT 0,
  total_tokens int NOT NULL DEFAULT 0,
  company_id uuid,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_usage_created ON public.ai_usage_log(created_at);
CREATE INDEX idx_ai_usage_provider ON public.ai_usage_log(provider);
```

RLS: Allow authenticated select for super admin. Insert via service role only (edge functions).

### New RPC: `get_ai_usage_summary`
A database function that returns aggregated token counts grouped by provider and model for 30/60/90 day buckets, avoiding client-side aggregation of potentially thousands of rows.

## Backend Changes

### `supabase/functions/_shared/aiRouter.ts`
After each successful `_callAISingle` call, extract `usage` from the API response (`data.usage.prompt_tokens`, `completion_tokens`, `total_tokens`) and insert a row into `ai_usage_log`. This is fire-and-forget (no await blocking the response). Add an optional `agentName` field to `AIRequestOptions` so callers can tag which agent made the call.

## Frontend Changes

### New: `src/components/ceo/AITokenUsageCard.tsx`
A card component showing:
- **Summary row**: Total tokens used in 30d / 60d / 90d with a tab or toggle selector
- **By Provider**: Gemini vs GPT breakdown (bar or donut chart using Recharts)
- **By Model**: Table showing each model's token usage
- **By Agent**: Which agents consumed the most tokens
- Trend sparkline showing daily usage over the selected period

### `src/pages/CEOPortal.tsx`
Add `<AITokenUsageCard />` after `BusinessHeartbeat`.

## Files Changed
- **Migration**: New `ai_usage_log` table + `get_ai_usage_summary` RPC
- `supabase/functions/_shared/aiRouter.ts` — log usage after each call
- `src/components/ceo/AITokenUsageCard.tsx` — new component
- `src/pages/CEOPortal.tsx` — add card

