

## Train Forge: Add Date Awareness, Tool Instructions, and Delivery Visibility

### Problem
Forge (shopfloor agent) has three gaps despite having tools deployed:
1. **No date awareness** — The system prompt never tells Forge what today's date is, so it can't reason about "today"
2. **No delivery data** — Forge says "I can't access deliveries" because delivery context is only loaded for `agent === "delivery"`
3. **Prompt doesn't list its new tools** — The `operations.ts` prompt for Forge doesn't mention `get_production_report`, `get_work_orders`, `get_cut_plan_status`, or `get_timeclock_summary`, so the model doesn't know to call them

### Changes

**File: `supabase/functions/ai-agent/index.ts`** (line 981-983)

Inject today's date (EST timezone) into the static system prompt:

```typescript
const todayEST = new Date().toLocaleDateString("en-US", {
  weekday: "long", year: "numeric", month: "long", day: "numeric",
  timeZone: "America/Toronto"
});

const staticSystemPrompt = ONTARIO_CONTEXT + basePrompt + 
  GOVERNANCE_RULES + DRAFT_ONLY_BLOCK + SHARED_TOOL_INSTRUCTIONS + IDEA_GENERATION_INSTRUCTIONS + LANG_INSTRUCTION +
  `\n\n## Current Date & Time\nToday is: ${todayEST}\nTimezone: Eastern (America/Toronto)` +
  `\n\n## Current User\nName: ${userFullName}\nEmail: ${userEmail}`;
```

**File: `supabase/functions/_shared/agents/operations.ts`** (shopfloor prompt)

Add a tools section to Forge's prompt listing its available tools and when to use them:

```
## Available Tools — USE THESE
You have these tools available. ALWAYS use them instead of saying you can't access data:

- **get_production_report**: Today's machine runs, pieces produced, operator activity. USE for "what happened today", "daily report", "status"
- **get_work_orders**: List work orders with status and priority. USE for "show work orders", "what's pending"
- **get_cut_plan_status**: Cut plan progress by phase. USE for "cut plan progress", "what's being cut"
- **get_timeclock_summary**: Who's clocked in, hours worked. USE for "who's working", "attendance"
- **update_machine_status**: Change machine status (idle, running, blocked, down)
- **create_notifications**: Create todos, alerts, ideas

CRITICAL: When asked about production, work orders, or employee activity — ALWAYS call the relevant tool FIRST. Never say "I don't have access" or "I can only update machine statuses." You have full read access to production data.
```

**File: `supabase/functions/_shared/agentContext.ts`** (shopfloor block, after line 210)

Add basic delivery data to Forge's context so it has cross-department visibility:

```typescript
// Deliveries (cross-department visibility for Forge)
const { data: deliveries } = await supabase
  .from("deliveries")
  .select("id, delivery_number, status, scheduled_date, driver_name, notes")
  .in("status", ["planned", "scheduled", "loading", "in_transit"])
  .order("scheduled_date", { ascending: true })
  .limit(15);
context.activeDeliveries = deliveries;
```

**Deploy**: Redeploy `ai-agent` edge function

### Files Changed

| File | Change |
|---|---|
| `ai-agent/index.ts` | Inject today's date into system prompt for all agents |
| `_shared/agents/operations.ts` | Add tool instructions to Forge's prompt |
| `_shared/agentContext.ts` | Add delivery data to shopfloor context |
| Deploy | Redeploy `ai-agent` |

