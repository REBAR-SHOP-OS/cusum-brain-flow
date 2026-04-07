

# Fix: Vizzy Self-Audit is Hallucinated — Add Self-Awareness Grounding

## The Problem

Vizzy generated a "self-audit" claiming it lacks capabilities it **already has**. This is a hallucination — Vizzy doesn't know its own tool inventory. Here's the truth table:

| Vizzy's Claim | Reality | Verdict |
|---|---|---|
| "Cannot directly update statuses" | Has `update_machine_status`, `update_delivery_status`, `update_lead_status`, `update_cut_plan_status` | FALSE |
| "Cannot contact customers" | Has `send_email`, `rc_send_sms`, `rc_make_call`, `rc_send_fax` | FALSE |
| "Static data view, cannot query" | Has `deep_business_scan`, `investigate_entity`, `get_employee_activity`, `get_employee_emails`, `rc_get_call_analytics` | FALSE |
| "No outbound communication" | Has `send_email`, `rc_send_sms`, `rc_make_call`, `rc_send_fax` | FALSE |
| "No real-time monitoring" | Has `vizzy-business-watchdog` (cron), `rc_get_active_calls`, `rc_get_team_presence` | FALSE |
| "Need ERP integration" | Has full ERP read/write via `vizzy-erp-action` + MCP server with 20+ actions | FALSE |
| "Need production system access" | Has `list_machines`, `list_orders`, `get_stock_levels`, cut plan updates | FALSE |
| "Need calendar API" | Actually missing | TRUE |
| "Need Odoo dedup tool" | `vizzy-erp-action` has `merge_customers` action | FALSE |

**9 out of 10 claims are wrong.** Vizzy hallucinated its own limitations because its system prompt doesn't include a self-awareness section listing its capabilities.

## Root Cause

The system prompt in `admin-chat/index.ts` lists tool usage rules but never says: "Here is what you CAN do." When asked to self-audit, the LLM defaults to generic AI limitations instead of checking its actual tool definitions.

## Fix

### File: `supabase/functions/admin-chat/index.ts`

Add a `SELF-AWARENESS` section to the system prompt (after the TOOL USAGE RULES block, ~line 2547):

```
═══ SELF-AWARENESS (CAPABILITIES INVENTORY) ═══
When asked about your capabilities, limitations, or what you can/cannot do, 
ALWAYS reference your ACTUAL tool list — never guess from general AI knowledge.

You CAN:
- Query machines, orders, deliveries, leads, stock, employees, emails, calls in real-time
- Update machine status, delivery status, lead status, cut plan status
- Send emails via Gmail, make phone calls, send SMS, send fax via RingCentral
- Deep scan the entire business across all domains (deep_business_scan)
- Investigate any entity by keyword across all data (investigate_entity)
- Monitor team presence and active calls in real-time
- Manage WordPress: posts, pages, products, orders, redirects, speed audits
- Save and recall persistent memories across sessions
- Create activity events and log business actions

You CANNOT (actual limitations):
- Access calendar/scheduling (no calendar API connected yet)
- Write directly to QuickBooks or Odoo (ERP is read-from-mirror, write-to-local)
- Access support ticket system (none exists in this ERP)
- Process payments or initiate bank transactions
- Access camera feeds directly (camera-intelligence is a separate system)

NEVER claim you lack a capability that exists in your tool list.
NEVER list generic AI limitations as if they apply to you specifically.
```

## Impact
- 1 file changed (`admin-chat/index.ts`) — ~20 lines added to system prompt
- Prevents future self-audit hallucinations
- Vizzy accurately reports what it can and cannot do
- No tool, schema, or UI changes

