

# Register 5 Customer/Contact Tools in MCP Server

## What This Does
Add 5 new MCP tool definitions to `supabase/functions/mcp-server/index.ts` that proxy requests to the existing `vizzy-erp-action` edge function. This exposes the customer management and merge capabilities to ChatGPT via the MCP protocol.

## Approach
Each tool calls `vizzy-erp-action` internally using `fetch()` with the service role key, passing the appropriate `action` and parameters. This follows the existing pattern but delegates to the edge function rather than querying the DB directly.

### Helper Function
Add a shared `callErpAction` helper at the top that constructs the fetch call:

```typescript
async function callErpAction(action: string, params: Record<string, unknown>) {
  const resp = await fetch(`${supabaseUrl}/functions/v1/vizzy-erp-action`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, ...params }),
  });
  return resp.json();
}
```

### 5 Tool Registrations

**1. `get_customer`** — Input: `{ id }` → calls `callErpAction("get_customer", { id })`

**2. `update_customer`** — Input: `{ id, payload, suppress_external_sync? }` → calls `callErpAction("update_customer", { id, payload, suppress_external_sync })`

**3. `list_contacts`** — Input: `{ company_id, limit?, offset? }` → calls `callErpAction("list_contacts", { company_id, limit, offset })`

**4. `create_contact`** — Input: `{ company_id, payload }` → calls `callErpAction("create_contact", { company_id, payload })`

**5. `merge_customers`** — Input: `{ primary_id, duplicate_ids, dry_run?, merge_reason?, suppress_external_sync? }` → calls `callErpAction("merge_customers", { primary_id, duplicate_ids, dry_run, merge_reason, suppress_external_sync })`

## File Changed

| File | Change |
|------|--------|
| `supabase/functions/mcp-server/index.ts` | Add `callErpAction` helper + 5 `mcpServer.tool()` registrations before the HTTP transport section (before line 723) |

## Deployment
The edge function will be redeployed automatically after the code change.

