

## Add "Deep Business Scan" Tool for Vizzy

### What You Want

A way to ask Vizzy to deeply search across ALL your business data — emails, pipeline, calls, activity logs, production — and learn everything about what's happening. Not just today's snapshot, but a comprehensive cross-domain intelligence scan.

### What Exists Now

- Vizzy gets a **single-day pre-digested context** (today only) via `vizzyFullContext.ts`
- Individual tools exist: `get_employee_emails` (one employee, one day), `get_employee_activity` (one employee, one day), `list_leads`, `list_orders`
- No tool exists to do a **cross-domain deep scan** across multiple data sources at once

### Solution: Add `deep_business_scan` Tool

A new tool in `admin-chat/index.ts` that aggregates data across ALL domains in a single call:

**What it scans:**
1. **Emails** — All communications for a date range (not just today), with body previews, unanswered threads
2. **Pipeline** — All active leads with scores, values, stages, last activity
3. **Calls** — RingCentral call logs with per-employee breakdown
4. **Activity** — All logged events across all employees
5. **Production** — Cut plans, work orders, machine utilization
6. **Financials** — AR/AP aging, overdue invoices/bills
7. **Deliveries** — Scheduled, in-transit, completed
8. **Agent usage** — Which AI agents are being used and by whom

**Parameters:**
- `date_from` (optional, defaults to 7 days ago)
- `date_to` (optional, defaults to today)
- `focus` (optional: "emails", "pipeline", "production", "financials", "all" — defaults to "all")
- `employee_name` (optional: filter to one person)

**How to use it:** Just tell Vizzy:
- "Deep scan the business" — scans everything for last 7 days
- "Go deep on all emails this week" — focuses on emails
- "Learn everything about what Vicky has been doing" — employee-specific scan
- "Scan the pipeline and financials for the last 30 days"

### Files Changed

| File | Change | Category |
|---|---|---|
| `supabase/functions/admin-chat/index.ts` | Add `deep_business_scan` tool definition + handler | Safe additive |

### Implementation Detail

1. Add tool definition to `JARVIS_TOOLS` array with parameters schema
2. Add `case "deep_business_scan"` in `executeReadTool` that runs parallel queries across communications, leads, activity_events, cut_plan_items, accounting_mirror, deliveries, work_orders, and chat_sessions for the given date range
3. Returns a structured summary organized by domain
4. Update the system prompt's tool usage section to mention this tool

### What is NOT Changed
- Existing tools remain unchanged
- Pre-digest flow unchanged
- No schema changes
- No new edge functions

