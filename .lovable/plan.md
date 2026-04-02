

# Fix Vizzy & Edge Functions to Use Workspace Timezone Setting

## Problem
Vizzy and 5 edge functions have hardcoded `"America/New_York"` or `"America/Toronto"` timezone strings. The new `workspace_settings` table exists but edge functions don't read from it.

## Approach

### Create a shared timezone helper for edge functions
New file: `supabase/functions/_shared/getWorkspaceTimezone.ts`
- Accepts a Supabase service client
- Queries `workspace_settings` for the timezone value
- Returns the timezone string, falling back to `"America/Toronto"` on any error
- Single query, cached per request

### Update 5 edge function files to use dynamic timezone

| File | Current hardcoded value | Change |
|------|------------------------|--------|
| `supabase/functions/vizzy-context/index.ts` | `"America/New_York"` (line 34) | Read from workspace_settings |
| `supabase/functions/_shared/vizzyFullContext.ts` | `"America/New_York"` (line 18) | Read from workspace_settings |
| `supabase/functions/comms-alerts/index.ts` | `"America/Toronto"` (line 207) | Read from workspace_settings |
| `supabase/functions/ai-agent/index.ts` | `"America/Toronto"` (lines 609, 980, 984) | Read from workspace_settings |
| `supabase/functions/kiosk-punch/index.ts` | `"America/New_York"` (line 42) | Read from workspace_settings |

### Implementation detail
- Each function already has a Supabase service client available
- The helper does one lightweight query: `SELECT timezone FROM workspace_settings LIMIT 1`
- If the query fails or returns null, falls back to `"America/Toronto"`
- No migration needed — table and seed row already exist

### Safety
- Fallback matches current Toronto behavior
- Single additional DB query per function invocation (lightweight)
- No breaking changes — same timezone value unless user changes it in Settings

