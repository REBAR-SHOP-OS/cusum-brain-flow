

# Add OAuth Authentication to MCP Server for ChatGPT

## Why This Is Needed
ChatGPT custom apps only support **OAuth** or **No Auth** -- not plain API keys. Your MCP server currently uses API key auth, so we need to add OAuth endpoints that ChatGPT can use.

## Approach: Simple OAuth 2.0 Client Credentials Flow
We will add two OAuth endpoints to the existing MCP server function. The `MCP_API_KEY` secret will be reused as the OAuth client secret -- no new secrets needed.

## Changes

### 1. Update `supabase/functions/mcp-server/index.ts`

Add two new routes **before** the MCP catch-all handler:

- **GET `/oauth/authorize`** -- ChatGPT redirects here; we immediately redirect back with an authorization code (since this is machine-to-machine, no user login needed)
- **POST `/oauth/token`** -- ChatGPT exchanges the code (or client credentials) for a Bearer token; validates `client_secret` against `MCP_API_KEY`

Update the auth middleware to also accept Bearer tokens issued by the `/oauth/token` endpoint.

### 2. No New Secrets or Database Tables
- Reuses existing `MCP_API_KEY` as the OAuth `client_secret`
- Authorization codes are short-lived, generated in-memory
- Access tokens are signed with `MCP_API_KEY` using a simple HMAC approach

### 3. No Config Changes
- `supabase/config.toml` already has `verify_jwt = false` for mcp-server
- No new edge functions needed

## ChatGPT Configuration (after implementation)

When setting up the ChatGPT custom app:

| Field | Value |
|-------|-------|
| Authentication | OAuth |
| Client ID | `rebar-erp` |
| Client Secret | Your `MCP_API_KEY` value |
| Authorization URL | `https://uavzziigfnqpfdkczbdo.supabase.co/functions/v1/mcp-server/oauth/authorize` |
| Token URL | `https://uavzziigfnqpfdkczbdo.supabase.co/functions/v1/mcp-server/oauth/token` |
| Scope | `mcp` |

## Technical Details

The OAuth flow works as follows:

1. ChatGPT calls `/oauth/authorize?client_id=rebar-erp&redirect_uri=...&state=...`
2. Server generates a one-time code and redirects back to ChatGPT's `redirect_uri`
3. ChatGPT calls `/oauth/token` with the code and `client_secret`
4. Server validates `client_secret` matches `MCP_API_KEY`, returns an access token
5. ChatGPT uses the access token as `Bearer` token on all MCP requests
6. The existing auth middleware already accepts `Bearer` tokens -- it just needs to also accept the OAuth-issued tokens

No files are moved, deleted, or restructured. Only `mcp-server/index.ts` is modified.
