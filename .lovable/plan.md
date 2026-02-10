

## Gauge Morning Briefing for Ben

When Ben says "good morning" (or similar greeting), Gauge will automatically gather data across 8 categories before responding with a comprehensive morning briefing.

### How it works

Two changes are needed:

1. **Edge function (`supabase/functions/ai-agent/index.ts`)** -- Expand the `estimation` agent's context fetching to include all 8 briefing categories, and add a greeting detection block that injects a structured morning briefing prompt.

2. **No frontend changes needed** -- The Agent Workspace already sends messages to the `ai-agent` edge function. The briefing logic lives entirely server-side.

### The 8 Briefing Categories

When a greeting is detected (e.g. "good morning", "morning", "hi", "hello"), Gauge will fetch and summarize:

| # | Category | Data Source | What Gauge Reports |
|---|----------|-------------|-------------------|
| 1 | Emails | `communications` table -- emails to/from `ben@rebar.shop` and `estimation@rebar.shop` | Unread count, flagged items, anything needing response |
| 2 | Estimation Ben | `leads` table filtered by `assigned_to` = Ben's ID, stage not won/lost | Open estimates, pending takeoffs, deadlines |
| 3 | QC Ben | `leads` with QC-related metadata or notes flagged | QC flags, validation warnings, items needing review |
| 4 | Addendums | `communications` + `lead_files` -- emails/files with "addendum" or "revision" keywords | New addendums received, unprocessed revisions |
| 5 | Estimation Karthick | `leads` filtered by Karthick's assigned_to | Karthick's open estimates, anything Ben should review |
| 6 | Shop Drawings | `leads` or `lead_files` with "shop drawing" references, not yet approved | Shop drawings in progress, pending submission |
| 7 | Shop Drawings for Approval | Same as above but filtered to "pending approval" status | Drawings waiting for engineer/client approval |
| 8 | Eisenhower | `chat_sessions` table for Ben's Eisenhower sessions | Yesterday's task completion, pending priorities |

### Technical Details

**In `fetchContext` (line ~1796), add estimation-specific briefing data:**

```typescript
if (agent === "estimation") {
  // Existing code stays...

  // NEW: Ben's emails (estimation + personal)
  const { data: estEmails } = await supabase
    .from("communications")
    .select("id, subject, from_address, to_address, body_preview, status, received_at, direction")
    .or("to_address.ilike.%ben@rebar.shop%,from_address.ilike.%ben@rebar.shop%,to_address.ilike.%estimation@rebar.shop%,from_address.ilike.%estimation@rebar.shop%")
    .order("received_at", { ascending: false })
    .limit(30);
  context.estimationEmails = estEmails;
  context.unreadEstEmails = (estEmails || []).filter(e => e.status === "unread" || !e.status).length;

  // Ben's assigned leads (estimation work)
  const { data: benLeads } = await supabase
    .from("leads")
    .select("id, title, stage, expected_value, probability, updated_at, notes, metadata, assigned_to")
    .not("stage", "in", '("won","lost")')
    .order("updated_at", { ascending: false })
    .limit(30);
  context.allActiveLeads = benLeads;

  // Lead files (for addendums + shop drawings)
  const { data: leadFiles } = await supabase
    .from("lead_files")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);
  context.leadFiles = leadFiles;

  // Eisenhower sessions for Ben
  if (userId) {
    const { data: eisSessions } = await supabase
      .from("chat_sessions")
      .select("id, title, updated_at")
      .eq("user_id", userId)
      .eq("agent_name", "Eisenhower Matrix")
      .order("updated_at", { ascending: false })
      .limit(3);
    context.eisenhowerSessions = eisSessions;
  }

  // Open tasks
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, status, priority, due_date, created_at")
    .neq("status", "done")
    .order("created_at", { ascending: false })
    .limit(20);
  context.userTasks = tasks;
}
```

**Greeting detection and briefing prompt injection (before AI call, ~line 2214):**

When `agent === "estimation"` and the message matches a greeting pattern (`/^(good\s*morning|morning|hi|hello|hey|salam|salaam)/i`), replace the user message with a structured briefing request that instructs Gauge to cover all 8 categories using the context data already loaded.

The injected prompt will instruct Gauge to:
- Present a structured morning briefing with all 8 sections
- Use tables and emoji tags for scannability
- Flag urgent items first
- Be concise (ADHD-friendly format)
- Reference actual data from context

**Model routing:** Morning briefings will use `google/gemini-2.5-pro` with higher max tokens (6000) since they require synthesizing data across multiple categories.

