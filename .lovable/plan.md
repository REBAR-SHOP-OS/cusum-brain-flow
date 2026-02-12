

## Build an MCP Server for GPT Integration

### What is this?
An MCP (Model Context Protocol) server that allows ChatGPT to connect to your app and read/manage data across all major sections: social posts, customers, leads, production, shop floor, and more.

### What you'll fill in GPT's form:
- **Name**: Rebar ERP
- **Description**: Connect to Rebar ERP for managing social posts, customers, leads, production, and shop floor data
- **MCP Server URL**: `https://uavzziigfnqpfdkczbdo.supabase.co/functions/v1/mcp-server`
- **Authentication**: None (we'll use a custom API key header for security)

### Tools GPT will have access to:

| Tool | Description |
|------|-------------|
| `list_social_posts` | View social media posts with filters (status, platform) |
| `list_leads` | View pipeline leads with stage filters |
| `list_customers` | View customer list |
| `list_production_tasks` | View production tasks and queue |
| `list_machines` | View machine status (idle, running, blocked) |
| `list_orders` | View orders and their status |
| `list_deliveries` | View delivery schedules |
| `list_time_entries` | View time clock entries |
| `get_dashboard_stats` | Get summary counts across all sections |

### Technical Details

#### 1. New Edge Function: `supabase/functions/mcp-server/index.ts`

- Uses **mcp-lite** library (npm:mcp-lite@^0.10.0) with Hono for HTTP routing
- Implements `StreamableHttpTransport` for MCP protocol compliance
- Secured with a custom `MCP_API_KEY` secret (Bearer token)
- Reads from public tables using service_role key (read-only operations)
- Each tool maps to a specific database query with pagination support

#### 2. New file: `supabase/functions/mcp-server/deno.json`

Import map for mcp-lite and hono dependencies.

#### 3. Update `supabase/config.toml`

Add `[functions.mcp-server]` with `verify_jwt = false` (auth handled by custom API key).

#### 4. New Secret: `MCP_API_KEY`

A custom API key you create (any strong random string). You'll use this as Bearer token in GPT's authentication settings if needed, or leave auth as "None" and embed the key check in the function.

### Security

- All operations are **read-only** (SELECT queries only)
- API key validation on every request
- No user data exposure (tokens, passwords, etc.)
- Results are paginated (max 50 rows per request)

### No changes to existing app

This is a standalone edge function. No UI, no component, and no existing file changes.

