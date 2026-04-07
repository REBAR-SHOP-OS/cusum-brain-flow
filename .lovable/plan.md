

# Fix: Vizzy Can't Access QuickBooks Data in Chat — Missing Tool Wiring

## Root Cause

`admin-chat/index.ts` has its own **separate** tool system (`JARVIS_TOOLS` array + `executeReadTool` switch statement) that is completely independent from the shared `agentTools.ts` / `agentToolExecutor.ts` used by the MCP server.

**Three critical QB tools are defined in `agentTools.ts` but NOT in `admin-chat`:**

| Tool | What it does | Status in admin-chat |
|------|-------------|---------------------|
| `fetch_qb_report` | Live AR/AP aging, P&L, Balance Sheet from QuickBooks | ❌ Missing |
| `fetch_gl_anomalies` | Scan GL for unusual transactions | ❌ Missing |
| `trigger_qb_sync` | Refresh local QB data mirror | ❌ Missing |

The system prompt tells Vizzy "use fetch_qb_report, never delegate" — but when the AI calls the tool, `executeReadTool` hits the `default` case at line 2310 and returns `{"error": "Unknown read tool: fetch_qb_report"}`. Vizzy then tells the CEO she can't access QB data and tries to delegate to Vicky.

## Fix

### 1. Add QB tool definitions to `JARVIS_TOOLS` array (~50 lines)

Add `fetch_qb_report`, `fetch_gl_anomalies`, and `trigger_qb_sync` tool definitions to the `JARVIS_TOOLS` array (before the closing `]` at line 902). Copy the exact definitions from `agentTools.ts` lines 487-536.

### 2. Add QB tool execution to `executeReadTool` switch (~80 lines)

Add three new cases before the `default` at line 2309:

- **`fetch_qb_report`**: Call `quickbooks-oauth` with the mapped action name and date parameters (same logic as `agentToolExecutor.ts` lines 592-667)
- **`fetch_gl_anomalies`**: Query `gl_transactions` for large/unbalanced/round-number entries (same logic as lines 672-719)
- **`trigger_qb_sync`**: Call `qb-sync-engine` edge function (same logic as lines 725-741)

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/admin-chat/index.ts` | Add 3 QB tools to `JARVIS_TOOLS` (~50 lines) + add 3 cases to `executeReadTool` switch (~80 lines) |

## Impact
- Vizzy can directly pull live QuickBooks data when the CEO asks about AR, AP, invoices
- No more "Unknown read tool" errors
- No more delegation to Vicky for financial data
- No database, auth, or UI changes
- The shared `agentToolExecutor.ts` is untouched — admin-chat gets its own inline implementation (consistent with its existing pattern)

