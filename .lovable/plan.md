

## Fix MCP Server - Wrong Tool Registration API

### Problem
The MCP server crashes on startup with `TypeError: Cannot read properties of undefined (reading 'inputSchema')` because `mcp-lite` expects the tool name as the first argument and options as the second argument, but the current code passes everything as a single object.

### Current (broken)
```typescript
mcpServer.tool({
  name: "list_social_posts",
  description: "...",
  inputSchema: { ... },
  handler: async (...) => { ... },
});
```

### Fixed
```typescript
mcpServer.tool("list_social_posts", {
  description: "...",
  inputSchema: { ... },
  handler: async (...) => { ... },
});
```

### Changes

**File: `supabase/functions/mcp-server/index.ts`**

Update all 10 tool registrations to use the correct two-argument API:
1. `list_social_posts`
2. `list_leads`
3. `list_customers`
4. `list_production_tasks`
5. `list_machines`
6. `list_orders`
7. `list_deliveries`
8. `list_time_entries`
9. `get_dashboard_stats`

Each call changes from `mcpServer.tool({ name: "x", ... })` to `mcpServer.tool("x", { ... })` -- removing the `name` property from the options object and passing it as the first string argument instead.

### No other changes needed
- No new files
- No config changes
- No frontend changes

### After fix
Redeploy the edge function automatically, then retry the ChatGPT "Create" button.

