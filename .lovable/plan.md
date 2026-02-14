

# Fix MCP Server: "Transport not bound to a server" Error

## Problem

The edge function logs show repeated errors:
```
Error: Transport not bound to a server
```

The current code calls `transport.handleRequest(c.req.raw, mcpServer)` directly, but mcp-lite v0.10.0 requires you to first **bind** the transport to the server using `transport.bind(server)`, which returns a request handler function.

## Fix

### File: `supabase/functions/mcp-server/index.ts`

Replace the current transport + handler setup:

```typescript
// CURRENT (broken)
const transport = new StreamableHttpTransport();
// ...
app.all("/*", async (c) => {
  const response = await transport.handleRequest(c.req.raw, mcpServer);
  // ...
});
```

With the correct bind pattern:

```typescript
// FIXED
const transport = new StreamableHttpTransport();
const httpHandler = transport.bind(mcpServer);
// ...
app.all("/*", async (c) => {
  const response = await httpHandler(c.req.raw);
  // ...
});
```

The key change:
1. Call `transport.bind(mcpServer)` to get a bound handler function
2. Call that handler with just the raw request (no second argument)

This is a 2-line change that fixes the Internal Server Error ChatGPT is receiving.

### Technical Details

| Item | Detail |
|------|--------|
| File modified | `supabase/functions/mcp-server/index.ts` |
| Lines changed | ~3 lines near the transport/handler section |
| Root cause | mcp-lite API requires `transport.bind(server)` before handling requests |

