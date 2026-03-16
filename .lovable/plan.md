

# Fix: Implement Missing Empire Agent Tool Handlers

## Problem
The empire agent defines `resolve_task` as a tool and references `generate_patch`, `create_fix_ticket`, `read_task`, `update_fix_ticket`, `list_fix_tickets`, and `validate_code` in its system prompt, but none of these have actual implementations in `agentToolExecutor.ts`. They all fall through to the generic `"Tool executed (simulated)"` fallback, making the autofix and code-patch workflows non-functional.

## Root Cause
- `resolve_task` is defined in `agentTools.ts` (line 266) but has no handler in `agentToolExecutor.ts`
- `generate_patch`, `create_fix_ticket`, `read_task`, `update_fix_ticket`, `list_fix_tickets`, `validate_code` are mentioned in the empire prompt but neither defined as tools in `agentTools.ts` nor handled in `agentToolExecutor.ts`
- `companyId` IS correctly fetched and passed through the chain — that is not the issue

## Plan

### 1. Add missing tool definitions to `agentTools.ts`
Add the following tools for the empire agent (alongside existing `db_read_query`, `db_write_fix`, `resolve_task`):
- `read_task` — read an autofix task by ID from `autopilot_tasks` or similar table
- `generate_patch` — create a code patch entry in `code_patches` table
- `validate_code` — basic static validation of a patch (syntax check)
- `create_fix_ticket` — insert into `fix_tickets` table
- `update_fix_ticket` — update a fix ticket status
- `list_fix_tickets` — list open fix tickets for the company

### 2. Add tool handler implementations to `agentToolExecutor.ts`
Before the default fallback (line 864), add `else if` blocks for each tool:

- **`resolve_task`**: Update the task record (in whichever table stores autofix tasks — likely `autopilot_runs` or a tasks table) with `status = "resolved"` and the resolution note. Uses `companyId` for tenant scoping.
- **`read_task`**: Fetch task by ID, scoped to `companyId`.
- **`generate_patch`**: Insert into `code_patches` table with `company_id`, `created_by`, file path, patch content, and status "pending".
- **`validate_code`**: Run basic validation (check for dangerous patterns like `DROP TABLE`, ensure patch content is non-empty).
- **`create_fix_ticket`**: Insert into `fix_tickets` table with company scoping.
- **`update_fix_ticket`**: Update fix ticket by ID.
- **`list_fix_tickets`**: Query open fix tickets for the company.

### 3. Database check
Before implementing, verify which tables exist (`code_patches`, `fix_tickets`, `autopilot_tasks`) to ensure the handlers target real tables.

### Technical Details

```text
agentTools.ts (empire block)
├── db_read_query     ✅ defined + implemented
├── db_write_fix      ✅ defined + implemented
├── resolve_task      ⚠️ defined, NOT implemented
├── read_task         ❌ not defined, not implemented
├── generate_patch    ❌ not defined, not implemented
├── validate_code     ❌ not defined, not implemented
├── create_fix_ticket ❌ not defined, not implemented
├── update_fix_ticket ❌ not defined, not implemented
└── list_fix_tickets  ❌ not defined, not implemented
```

The fix touches two files:
- `supabase/functions/_shared/agentTools.ts` — add 6 tool definitions
- `supabase/functions/_shared/agentToolExecutor.ts` — add 7 tool handlers (before line 864)

May also require a database migration to create `fix_tickets` table if it doesn't exist.

