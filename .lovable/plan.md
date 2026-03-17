

# Fix Empire Agent — Broken Tools for rebar.shop Diagnostics

## Root Causes

**Two critical issues** prevent the empire agent from running diagnostics:

### 1. Missing `execute_readonly_query` database function
The `db_read_query` tool calls `svcClient.rpc("execute_readonly_query", { sql_query })` — but this PostgreSQL function **does not exist** in the database. Every DB read fails silently.

### 2. Missing WordPress tools for the empire agent
The empire agent's prompt instructs it to call `wp_list_products`, `wp_list_pages`, `wp_update_post`, `scrape_page`, etc. — but `getTools("empire")` in `agentTools.ts` only registers DB/fix-ticket tools. **No WordPress tools are available**, so the AI hallucinates tool calls that fail.

The `admin-chat` edge function has all the WordPress tools and their execution logic, but the `ai-agent` empire path doesn't.

## Fix Plan

### Step 1: Create `execute_readonly_query` database function
SQL migration to create a `SECURITY DEFINER` function that runs read-only queries via the service client. Restricted to SELECT only with a safeguard.

### Step 2: Create `execute_write_fix` database function
Same pattern for write operations — the empire agent also needs this for fixes.

### Step 3: Add WordPress tools to `getTools("empire")` in `agentTools.ts`
Register the same WordPress read/write tools that `admin-chat` has:
- `wp_list_posts`, `wp_list_pages`, `wp_list_products`, `wp_list_orders`
- `wp_get_site_health`
- `wp_update_post`, `wp_update_page`, `wp_update_product`
- `scrape_page` (fetch any URL and return HTML/text)

### Step 4: Add WordPress tool execution to `agentToolExecutor.ts`
The executor currently doesn't handle WP tools — it needs a `WPClient` import and execution branches for all the wp_* tools, plus a `scrape_page` tool that fetches any URL.

### Step 5: Update empire agent prompt
Remove references to `diagnose_platform` (not a real tool) and align the prompt with the actual available tool names.

### Step 6: Deploy `ai-agent` edge function

## Files Changed

| File | Action |
|------|--------|
| Database migration | Create `execute_readonly_query` + `execute_write_fix` functions |
| `supabase/functions/_shared/agentTools.ts` | Add WP tools + `scrape_page` to empire agent |
| `supabase/functions/_shared/agentToolExecutor.ts` | Add WP tool execution + scrape_page handler |
| `supabase/functions/_shared/agents/empire.ts` | Fix prompt to reference real tool names only |

