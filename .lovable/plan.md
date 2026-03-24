
## Audit Summary

The date itself is already available to Forge. The real bug is in how Forge fetches and interprets work orders:

- `get_work_orders` currently returns **active** work orders, not **today’s** work orders
- The tool does **not select `created_at`**, even though `work_orders` has that column
- The tool defaults to `queued/pending/in-progress`, so Forge is showing a live queue and calling it “today’s”
- The context loader has the same issue: `activeWorkOrders` includes active rows only, without creation-date visibility
- Chat history is already passed into `ai-agent`, so Forge can see the prior conversation; it just needs better tool data + prompt rules

I also verified the database has `work_orders.created_at`, and the sampled rows Forge listed were mostly created in February, so they are clearly **not all dated today**.

## Fix Plan

### 1. Fix the work-order tool so Forge can answer date questions correctly
Update `supabase/functions/_shared/agentToolExecutor.ts`:

- Expand `get_work_orders` to select:
  - `created_at`
  - `scheduled_start`
  - `order_id`
  - existing status/priority/notes
  - joined order/customer info if available
- Add support for an explicit date mode such as:
  - `created_today`
  - `scheduled_today`
  - `active`
- Return clear booleans/labels in the result, for example:
  - `is_created_today`
  - `is_scheduled_today`
- Sort appropriately for the chosen date mode

Result: Forge can distinguish “created today” from “scheduled today” from “currently active”.

### 2. Fix Forge’s default interpretation of “today’s work orders”
Update `supabase/functions/_shared/agentTools.ts`:

- Improve the `get_work_orders` tool schema so the model can request the right mode instead of guessing
- Make the description explicit:
  - “today’s work orders” must not automatically mean active work orders
  - the tool should be used to check creation date and/or scheduled date

Result: the model has a better API contract.

### 3. Fix shopfloor context so passive answers are not misleading
Update `supabase/functions/_shared/agentContext.ts`:

- Include `created_at` in work-order context
- Optionally split context into:
  - `activeWorkOrders`
  - `todayCreatedWorkOrders`
  - `todayScheduledWorkOrders`

Result: even when Forge answers from context instead of a tool call, it won’t confuse “active” with “today”.

### 4. Train Forge to use conversation history properly
Update `supabase/functions/_shared/agents/operations.ts`:

Add explicit rules for follow-up questions like:
- “is all dated today?”
- “are these really today’s?”
- “check again”

Forge should:
- use the previous list from conversation/history as the subject of the follow-up
- verify with `created_at` and `scheduled_start`
- answer carefully:
  - “These are active work orders”
  - “Not all were created today”
  - “X were created today, Y were scheduled today, Z are simply active”

Also add a rule:
- If “today” is ambiguous, Forge must report both:
  - created today
  - scheduled today

### 5. Keep existing date-awareness work, no extra date patch needed
`supabase/functions/ai-agent/index.ts` already injects today’s date in Eastern time, so no new change is needed there unless we want to refine formatting.

## Files to Update

- `supabase/functions/_shared/agentToolExecutor.ts`
- `supabase/functions/_shared/agentTools.ts`
- `supabase/functions/_shared/agentContext.ts`
- `supabase/functions/_shared/agents/operations.ts`

## Expected Behavior After Fix

When the user says “Show today’s work orders”, Forge should no longer dump all active work orders unless they are actually filtered for today.

When the user follows with “is all dated today?”, Forge should answer with something like:

- “No. These are active work orders, not all created today.”
- “Created today: X”
- “Scheduled today: Y”
- “Still active from earlier dates: Z”

## Validation

After implementation, test these exact flows in Forge:

1. Ask: “Show today’s work orders”
2. Confirm the response is filtered by the intended meaning of “today”
3. Ask: “is all dated today?”
4. Confirm Forge uses the prior result and answers with real date-based counts instead of saying it lacks date info
5. Ask a mixed follow-up like “show active but tell me which ones were created today” and confirm it distinguishes both correctly
