

## Fix Eisenhower Agent: Remove Vizzy Brain, Add Multilingual Support

### Problem
The Eisenhower agent is mapped to `"Vizzy"` in the `agentStrategyMap` (line 323 of `agentContext.ts`), which injects Vizzy's brain strategy docs — including the "Our primary language for external communication is English" rule. This overrides the Eisenhower prompt behavior.

### Changes

**1. `supabase/functions/_shared/agentContext.ts` (line 323)**
- Change `eisenhower: "Vizzy"` → `eisenhower: "Eisenhower"` so it loads its own strategy (or none if no matching brain doc exists), instead of Vizzy's.

**2. `supabase/functions/_shared/agents/growth.ts` (eisenhower prompt)**
- Add a multilingual rule: "Always respond in the same language the user writes in. If the user writes in Persian, respond in Persian. If English, respond in English."
- Keep the structured Eisenhower Matrix output format intact.

**3. Deploy `ai-agent`** edge function to apply changes.

### Files

| File | Change |
|---|---|
| `agentContext.ts` line 323 | `eisenhower: "Vizzy"` → `eisenhower: "Eisenhower"` |
| `agents/growth.ts` eisenhower prompt | Add multilingual response rule |
| Deploy `ai-agent` | Redeploy |

