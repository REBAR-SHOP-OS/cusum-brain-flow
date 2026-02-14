
# Add Team Hub Tools to MCP Server

Add three new MCP tools so ChatGPT (and other MCP clients) can read Team Hub data: channels, messages, and channel members.

## New Tools

### 1. `list_team_channels`
- Returns all team channels (id, name, description, channel_type, created_at)
- Optional filter by `channel_type` (group, dm)
- Limit up to 50

### 2. `list_team_messages`
- Returns messages for a given channel
- Required: `channel_id`
- Optional: `limit` (default 50)
- Includes sender_profile_id, original_text, original_language, translations, created_at
- Ordered by most recent first

### 3. `list_team_members`
- Returns members of a given channel
- Required: `channel_id`
- Returns profile_id and joined_at

## File Modified

- `supabase/functions/mcp-server/index.ts` -- Add three new `mcpServer.tool()` registrations before the HTTP Transport section (around line 258), following the same pattern as existing tools.

## No Database Changes Needed

The tables `team_channels`, `team_messages`, and `team_channel_members` already exist. The MCP server uses the service role key, so RLS is bypassed.
