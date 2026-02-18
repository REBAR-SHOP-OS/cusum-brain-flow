
# Make Architect Agent Actually Fix Problems (Database Diagnostic Tools)

## Problem
When the Architect receives a bug like "failed to open DM", it says "I cannot directly modify client-side code." But most of these bugs are NOT code bugs -- they are **database-level issues** (RLS policy violations, missing tables/columns, broken permissions). The agent has no tool to investigate or fix these.

## Root Cause Analysis
The "failed to open DM" error specifically is caused by an RLS policy violation when inserting into `team_channels` or `team_channel_members`. The agent has tools for machines, deliveries, WordPress, Odoo -- but NO tool to:
- Query database tables to understand the structure
- Check RLS policies to find permission issues
- Run safe SQL fixes (like adjusting policies or inserting missing data)

## Solution: Add 2 New Tools to the Architect Agent

### 1. `db_read_query` Tool (Read-Only Database Inspector)
Allows the agent to run SELECT queries to investigate issues:
- Check RLS policies: `SELECT * FROM pg_policies WHERE tablename = 'team_channels'`
- Check table structure: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'team_channels'`
- Check data state: `SELECT * FROM team_channel_members WHERE profile_id = '...'`
- Find missing records that cause errors

**Safety**: Only SELECT statements allowed. INSERT/UPDATE/DELETE blocked.

### 2. `db_write_fix` Tool (Safe Database Fixer)
Allows the agent to run approved SQL fixes:
- Fix RLS policies that block legitimate operations
- Insert missing records (e.g., missing profile links)
- Update broken data states

**Safety**: 
- Requires `confirm: true` parameter (same pattern as `odoo_write`)
- Blocked patterns: `DROP TABLE`, `DROP DATABASE`, `TRUNCATE`, `ALTER TABLE ... DROP`
- All executions logged to `activity_events` with source = "architect_db_fix"

### 3. Update System Prompt
Add to the Architect's autofix behavior:
- "When you receive a client-side error, FIRST use `db_read_query` to investigate the database (check RLS policies, table structure, data state)"
- "If the root cause is a database issue, use `db_write_fix` to apply the fix"
- "If it's truly a code-only issue, provide a precise Lovable fix prompt with file paths and exact changes"

## Files Modified

| File | Change |
|------|--------|
| `supabase/functions/ai-agent/index.ts` | Add `db_read_query` and `db_write_fix` tool definitions + handlers + update system prompt |

## No Changes To
- Any frontend file
- Database schema
- Any other edge function
- WordPress/Odoo integrations

## Technical Details

### db_read_query Tool Definition
```
name: "db_read_query"
parameters: { query: string }
```
Handler: Uses `svcClient.rpc` or raw SQL via service client. Validates query starts with SELECT/WITH. Returns up to 50 rows.

### db_write_fix Tool Definition
```
name: "db_write_fix"
parameters: { query: string, reason: string, confirm: boolean }
```
Handler: Validates no destructive patterns. Requires `confirm: true`. Logs to `activity_events`. Executes via service role client.

### System Prompt Addition (Autofix section)
```
When you receive a bug report about a client-side error:
1. Use `db_read_query` to check RLS policies: SELECT * FROM pg_policies WHERE tablename = '<table>'
2. Use `db_read_query` to check the actual data state
3. If the issue is an RLS policy or data problem, use `db_write_fix` to apply the fix
4. If the issue is purely frontend code, generate a precise Lovable fix prompt with:
   - Problem description
   - Root cause
   - File path(s)
   - Exact code changes needed
   - Test criteria
```

## How This Fixes the "Failed to Open DM" Example
1. Agent receives the autofix request
2. Runs `db_read_query`: `SELECT * FROM pg_policies WHERE tablename = 'team_channels'`
3. Discovers the INSERT policy is too restrictive (e.g., missing company_id check)
4. Runs `db_write_fix`: `CREATE POLICY ... ON team_channels FOR INSERT ...` with `confirm: true`
5. Calls `resolve_task` with resolution note
6. Green banner appears with [FIX_CONFIRMED]
