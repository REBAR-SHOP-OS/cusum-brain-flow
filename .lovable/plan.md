

# Vizzy Autopilot Mode — Implementation Plan

## Summary

Upgrade Vizzy to a self-governing autopilot that auto-executes routine delegation, only asks you for real decisions, and self-audits the entire ERP to find issues proactively. You tell her yes or no — she does the rest.

## What Changes

### 1. Autopilot Voice Instructions (`useVizzyVoiceEngine.ts`)

Replace the current "confirm each item" flow with three tiers:

- **AUTO-EXECUTE (no confirmation):** Create tasks for employees when red flags are found (overdue invoices, missed calls without callback, stalled leads 7+ days, production stuck 2+ days), send routine follow-up emails (invoice reminders, delivery confirmations), log fix requests.
- **CONFIRM FIRST (quick yes/no):** Business commitment emails to customers/partners, changing lead/order/delivery statuses, task reassignment between employees. Vizzy says "I want to do X — go ahead?" and waits for your yes or no.
- **CEO-ONLY (decisions list):** Financial decisions, personnel issues, pricing changes, client escalation calls. Presented as "Here's what only you can decide."

Add **SELF-AUDIT PROTOCOL** — on session start, Vizzy scans the ERP and auto-creates tasks:
- Overdue invoices >30 days → task for accounting
- Missed calls with no callback → task for that salesperson
- Stalled leads (7+ days) → task for assigned rep
- Production stuck >2 days → task for shop floor lead
- Unanswered emails >24h → flag to CEO or auto-draft

Remove banned phrase "Would you like me to..." — Vizzy just acts.

### 2. Batch Actions in Backend (`vizzy-erp-action/index.ts`)

Two new action cases:

- **`batch_create_tasks`**: Accepts `{ tasks: [{title, description, assigned_to_name, priority, category}] }`. Loops through array, resolves names to profiles using existing fuzzy logic, inserts all. Returns summary count.
- **`update_task_status`**: Accepts `{ task_id, status, reassign_to_name? }`. Updates task status and optionally reassigns.

### 3. Open Tasks in Context (`vizzyFullContext.ts`)

Add query for `human_tasks` (status open/snoozed, limit 50) joined to profiles to resolve assigned_to → employee name. Append as `═══ OPEN TASKS ═══` section so Vizzy knows what's already assigned and avoids duplicates.

### 4. Pre-Digest Autopilot Intelligence (`vizzy-pre-digest/index.ts`)

Add three new sections to the digest AI prompt:
- **AUTO-DELEGATION PLAN**: For each red flag, pre-built task title + which employee should handle it
- **CEO-ONLY DECISIONS**: Items requiring your judgment, ranked by business impact
- **SELF-IMPROVEMENT NOTES**: Operational patterns Vizzy noticed (e.g., "Neel consistently misses follow-up emails after calls")

### 5. Batch Action Handler (`VizzyVoiceChat.tsx`)

Update the `[VIZZY-ACTION]` parser to handle multiple actions per transcript and `batch_create_tasks` type. Show a single summary toast: "Vizzy auto-created 4 tasks and sent 2 follow-up emails" instead of individual popups.

## Technical Details

**Files to modify:**
- `src/hooks/useVizzyVoiceEngine.ts` — autopilot tiered instructions, self-audit protocol, banned phrases update
- `supabase/functions/vizzy-erp-action/index.ts` — `batch_create_tasks` and `update_task_status` action cases
- `supabase/functions/_shared/vizzyFullContext.ts` — open tasks query + context section
- `supabase/functions/vizzy-pre-digest/index.ts` — auto-delegation plan, CEO-only decisions, self-improvement notes
- `src/components/vizzy/VizzyVoiceChat.tsx` — batch action parsing + summary toasts

**Action formats:**
```text
[VIZZY-ACTION]{"type":"batch_create_tasks","tasks":[
  {"title":"Follow up invoice #123","assigned_to_name":"Neel","priority":"high"},
  {"title":"Return missed call to ACME","assigned_to_name":"Saurabh","priority":"medium"}
]}[/VIZZY-ACTION]

[VIZZY-ACTION]{"type":"update_task_status","task_id":"uuid","status":"acted"}[/VIZZY-ACTION]
```

