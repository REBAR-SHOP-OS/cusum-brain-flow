

## Fix: Vizzy (assistant agent) Has No Business Data

**Root Cause**: In `supabase/functions/ai-agent/index.ts` line 383, executive context is only fetched for `data`, `empire`, and `commander` agents. The `assistant` agent (Vizzy) gets basic context only — no financials, no production KPIs, no pipeline data. That's why she says "I do not have access to a real-time dashboard."

### Change

**`supabase/functions/ai-agent/index.ts` (line 383)** — Add `assistant` to the executive context condition:

```
if (agent === "data" || agent === "empire" || agent === "commander" || agent === "assistant") {
```

This single-line change gives Vizzy the full executive context (financials, production, pipeline, deliveries, team presence) that she needs for daily briefings and strategic analysis.

**Redeploy `ai-agent` edge function.**

