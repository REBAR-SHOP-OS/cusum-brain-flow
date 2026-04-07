

# Add SEO, Team Hub & Full Tool Access to Vizzy

## What's Missing

Vizzy currently has **no SEO tools** and **no Team Hub messaging tools**. She can't check keyword rankings, run SEO audits, or send messages to employees in Team Hub — even though the infrastructure exists.

## New Tools to Add

### SEO Tools (5 tools — all READ except `seo_run_strategy`)

| Tool | Type | What It Does |
|------|------|-------------|
| `seo_get_overview` | Read | Get domain health: keyword count, avg position, traffic trends, top pages |
| `seo_list_keywords` | Read | Query keywords with filters (position, volume, trend, opportunity score) |
| `seo_list_tasks` | Read | Query SEO tasks by status/priority/type |
| `seo_run_audit` | Write | Trigger AI analysis, local audit, or AI visibility audit for the domain |
| `seo_run_strategy` | Write | Generate AI strategic tasks (calls seo-ai-strategy) |

### Team Hub Tools (2 tools)

| Tool | Type | What It Does |
|------|------|-------------|
| `teamhub_send_message` | Write | Send a message to a Team Hub channel or DM (requires CEO approval) |
| `teamhub_list_messages` | Read | Read recent messages from a channel/DM |

## File Changes

### 1. `supabase/functions/admin-chat/index.ts`

**Tool definitions** (~70 lines added to `JARVIS_TOOLS`):

- `seo_get_overview`: No params. Queries `seo_domains` + aggregate stats from `seo_keyword_ai`, `seo_page_ai`, `seo_tasks`
- `seo_list_keywords`: Params: `min_position?`, `max_position?`, `min_volume?`, `trend?` ("rising"/"falling"), `limit?` (default 20). Queries `seo_keyword_ai`
- `seo_list_tasks`: Params: `status?`, `priority?`, `task_type?`, `limit?`. Queries `seo_tasks`
- `seo_run_audit`: Params: `audit_type` ("analyze"/"local"/"ai-visibility"). Invokes the matching edge function
- `seo_run_strategy`: No params. Invokes `seo-ai-strategy`
- `teamhub_send_message`: Params: `channel_name` (required), `message` (required). Resolves channel by name from `team_channels`, inserts into `team_messages`
- `teamhub_list_messages`: Params: `channel_name` (required), `limit?` (default 20). Resolves channel, queries `team_messages` with sender profile join

**WRITE_TOOLS set** — add `seo_run_audit`, `seo_run_strategy`, `teamhub_send_message`

**Read handlers** (~80 lines in `executeReadTool`):

- `seo_get_overview`: Get company's domain from `seo_domains`, aggregate keyword/page/task counts
- `seo_list_keywords`: Query `seo_keyword_ai` with filters, return top N
- `seo_list_tasks`: Query `seo_tasks` with filters
- `teamhub_list_messages`: Resolve channel name → id from `team_channels`, query `team_messages` joined with `profiles` for sender names

**Write handlers** (~40 lines in `executeWriteTool`):

- `seo_run_audit`: Call the appropriate edge function (`seo-ai-analyze`, `seo-local-audit`, or `seo-ai-visibility-audit`) via internal fetch
- `seo_run_strategy`: Call `seo-ai-strategy` via internal fetch
- `teamhub_send_message`: Resolve channel name → id, insert message with CEO's profile_id as sender

**progressLabels** — add: `seo_get_overview: "SEO overview"`, `seo_list_keywords: "SEO keywords"`, `seo_list_tasks: "SEO tasks"`, `teamhub_list_messages: "team messages"`

**buildActionDescription** — add cases for `seo_run_audit`, `seo_run_strategy`, `teamhub_send_message`

### 2. `supabase/functions/_shared/vizzyIdentity.ts`

Update the **"You CAN"** block (line ~289-302) to add:

```
- Query SEO performance: keywords, rankings, pages, tasks, domain health (seo_get_overview, seo_list_keywords, seo_list_tasks)
- Run SEO audits: site analysis, local SEO, AI visibility (seo_run_audit)
- Generate AI strategic SEO tasks (seo_run_strategy)
- Send messages to employees via Team Hub (teamhub_send_message) — with CEO approval
- Read Team Hub conversations (teamhub_list_messages)
```

## How It Works End-to-End

**CEO says:** "How are our SEO rankings?"
→ Vizzy calls `seo_get_overview` + `seo_list_keywords` (read tools, no approval needed)
→ Returns keyword positions, traffic trends, top opportunities

**CEO says:** "Run a local SEO audit"
→ Vizzy calls `seo_run_audit` with `audit_type: "local"` → confirmation UI appears
→ CEO approves → function invokes `seo-local-audit` edge function → returns audit + auto-creates tasks

**CEO says:** "Tell Neel to check the warehouse"
→ Vizzy calls `teamhub_send_message` with channel resolution → confirmation UI
→ CEO approves → message posted to Team Hub as CEO

## Impact
- 2 files changed (`admin-chat/index.ts`, `vizzyIdentity.ts`)
- ~190 lines added
- Vizzy gains full SEO intelligence and Team Hub communication
- All write operations require CEO approval
- No database or UI changes

