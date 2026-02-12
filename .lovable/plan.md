

## Fix MCP Server "Unauthorized" Error

### Problem
ChatGPT's "No Auth" mode sends requests without any API key headers, but the MCP server currently requires a valid `MCP_API_KEY`. This causes every request to be rejected with `401 Unauthorized`.

### Solution
Update the auth middleware in `supabase/functions/mcp-server/index.ts` to **skip API key validation when no `MCP_API_KEY` secret is configured**. This way:

- If `MCP_API_KEY` is set as a secret, the server enforces it (for securing the endpoint later).
- If `MCP_API_KEY` is **not set** (current state), the server allows requests through -- matching ChatGPT's "No Auth" mode.

### Changes

**File: `supabase/functions/mcp-server/index.ts`**

Update the auth middleware (around line 175-190) to only enforce the API key check when the environment variable exists:

```typescript
// Current (always checks):
if (mcpApiKey) {
  // validates key...
}

// This logic is already correct! But MCP_API_KEY secret IS set.
```

Actually, the `MCP_API_KEY` secret **is already configured** in your project (it was added previously). That means the check fires and rejects ChatGPT's keyless requests.

**Two options:**

**Option A (Recommended):** Remove the `MCP_API_KEY` secret so the server allows unauthenticated access, matching "No Auth" in ChatGPT. The endpoint is still somewhat protected by obscurity (long URL).

**Option B:** Remove the API key check entirely from the middleware code, making the endpoint always open.

We'll go with **Option B** -- remove the API key validation block from the middleware so ChatGPT can connect freely. If you want to re-add security later, you can switch ChatGPT to a different auth mode.

### Specific code change

In `supabase/functions/mcp-server/index.ts`, simplify the middleware to only handle CORS preflight, removing the API key validation entirely:

```typescript
app.use("*", async (c, next) => {
  if (c.req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  await next();
});
```

### No other changes
- No new files
- No config changes
- No frontend changes
- Redeploy the edge function automatically

