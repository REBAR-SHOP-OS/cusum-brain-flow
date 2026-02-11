

## Add Team Activity Report to All Agents (Role-Aware)

### What This Does
Every AI agent will receive a per-person "Team Activity Report" showing what each team member did today — clock-in/out, emails sent/received, tasks created/completed, and agent sessions used. This data is injected into the agent's context so it can answer questions like "what did Vicky do today?" regardless of which agent you're talking to.

### Role-Based Scoping
- **Admin / Office / Sales / Accounting**: See full activity for all team members (emails, tasks, agent sessions, time clock)
- **Workshop / Field**: See only team clock-in/out status and their own activity — no email counts, task details, or financial context for others

### What Changes

**Single file: `supabase/functions/ai-agent/index.ts`**

Add a new block inside the `fetchContext` function (after line ~2064, before the `return context` statement) that runs for ALL agents:

1. **Fetch today's data** (4 parallel queries, all limited + date-filtered):
   - `time_clock_entries` (today) joined via profile lookup
   - `chat_sessions` (today) for agent session counts
   - `communications` (today) for email volume
   - `tasks` created or completed today

2. **Build per-person activity map** using the hardcoded team directory:
   ```
   { name, role, clockStatus, emailsSent, emailsReceived, tasksCreated, tasksCompleted, agentSessions }
   ```

3. **Inject into context** as `context.teamActivityReport` — a formatted text block (not raw data) to keep token count small

4. **Role guard**: If user has only workshop/field roles, strip email and task counts — only show clock status

### Prompt Injection

Append a small instruction to the shared `SHARED_TOOL_INSTRUCTIONS` block:
```
## Team Activity (Today)
{teamActivityReport}

Use this data to answer questions about what team members did today.
```

### Safety Guards
- All queries use `.limit(200)` and filter to today's date only
- Queries run in a `Promise.all` inside a try/catch — failure logs a warning and returns empty data (no crash)
- No schema changes, no new tables, no UI changes
- Role filtering happens server-side before injecting into prompt
- Total added token budget: ~300-500 tokens (formatted summary, not raw JSON)

### Team Directory (Hardcoded, matching Vizzy)
Maps emails to names for cross-referencing:
- sattar@rebar.shop = Sattar Esmaeili (CEO)
- neel@rebar.shop = Neel Mahajan (Co-founder)
- vicky@rebar.shop = Vicky Anderson (Accountant)
- saurabh@rebar.shop = Saurabh Seghal (Sales)
- ben@rebar.shop = Ben Rajabifar (Estimator)
- kourosh@rebar.shop = Kourosh Zand (Shop Supervisor)
- radin@rebar.shop = Radin Lachini (AI Manager)

### Files Modified
- `supabase/functions/ai-agent/index.ts` — add ~60 lines to `fetchContext` + ~5 lines to prompt assembly

