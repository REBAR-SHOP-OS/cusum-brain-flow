

# Fix MCP Server Authentication for ChatGPT

## Root Cause

ChatGPT's MCP connector follows the MCP OAuth specification, which requires OAuth discovery endpoints at the **domain root** level:
- `https://uavzziigfnqpfdkczbdo.supabase.co/.well-known/oauth-authorization-server`
- `https://uavzziigfnqpfdkczbdo.supabase.co/.well-known/oauth-protected-resource`

Edge functions can only serve requests under `/functions/v1/mcp-server/`. They cannot control the domain root. This means **custom OAuth from an edge function will never work** with ChatGPT's MCP connector.

When ChatGPT tries to validate OAuth, it checks the domain root, gets `{"error":"requested path is invalid"}` from Supabase's gateway, and reports "does not implement OAuth."

## Solution: Switch to API Key Authentication

Instead of OAuth, configure the ChatGPT MCP connector with **"No Auth"** or **"API Key"** (if available in the dropdown), and pass the API key via a query parameter or header that the server already supports.

### Changes to `supabase/functions/mcp-server/index.ts`

1. **Add query parameter auth support** -- Allow the API key to be passed as a `?api_key=` query parameter on the MCP Server URL itself. This way, ChatGPT includes it automatically with every request.

2. **Remove unused OAuth code** -- Clean up the OAuth endpoints (`/oauth/authorize`, `/oauth/token`, well-known endpoints) since they cannot work from an edge function. This simplifies the codebase.

3. **Keep existing auth methods** -- The `x-api-key` header and `Authorization: Bearer` header methods continue to work for other clients.

### Updated Auth Middleware Logic

```text
Check for API key in this order:
1. x-api-key header
2. Authorization: Bearer header  
3. ?api_key= query parameter
```

### ChatGPT Configuration

When setting up the connector in ChatGPT:

| Field | Value |
|-------|-------|
| MCP Server URL | `https://uavzziigfnqpfdkczbdo.supabase.co/functions/v1/mcp-server?api_key=YOUR_KEY_HERE` |
| Authentication | None (or API Key if available) |

By embedding the API key in the URL, ChatGPT will include it automatically in every request to the MCP server.

### Files Modified

- `supabase/functions/mcp-server/index.ts` -- Add query param auth, remove OAuth endpoints

### Security Note

The API key in the URL is transmitted over HTTPS (encrypted in transit). While URL-based keys are generally less ideal than headers, this is the standard workaround for MCP clients that don't support custom headers without OAuth.

