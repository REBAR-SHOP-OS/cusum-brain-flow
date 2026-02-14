

# Fix MCP Server OAuth: Secret Name Mismatch

## Problem
Two issues are preventing ChatGPT from connecting:

1. **Secret name mismatch** -- The code reads `MCP_API_KEY` but the stored secret is named `MCP_API_KEYV1`. This causes all OAuth endpoints to fail with errors because the key is `undefined`.
2. **OAuth error** -- ChatGPT reports "does not implement OAuth" because the authorize and token endpoints return 500 errors (due to the missing key) instead of proper OAuth responses.

## Fix

### Update `supabase/functions/mcp-server/index.ts`

Change line 13 from:
```
const mcpApiKey = Deno.env.get("MCP_API_KEY");
```
to:
```
const mcpApiKey = Deno.env.get("MCP_API_KEYV1");
```

This single-line change will fix both issues since all the OAuth logic already works correctly -- it just needs to read the right secret name.

## After Deployment

Once deployed, click **Create** again in the ChatGPT MCP setup dialog. The OAuth flow should now complete successfully with the same configuration values you already entered.

