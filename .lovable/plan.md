

## Fix Notification Emails: Token Refresh, From Address & Subject

### Root Cause
Edge function logs show: **"Failed to get Gmail access token"**. The `notify-lead-assignees` function refreshes the OAuth token using `GMAIL_REFRESH_TOKEN` but doesn't log the actual Google error response, so we can't see why it's failing. Additionally, the raw email has no `From:` header and the subject doesn't match the requested format.

### Problems to Fix
1. **Token refresh failing silently** — The function checks `!tokenData.access_token` but doesn't log the actual Google error response (could be `invalid_grant`, expired token, etc.)
2. **No From header** — The raw email is missing `From: ai@rebar.shop`, so Gmail uses whatever default the token owner has
3. **Wrong subject format** — Currently `[Rebar.shop] Lead Update: {title}`, should be `ERP | Rebar.shop | {lead_title}`

### Changes

**File: `supabase/functions/notify-lead-assignees/index.ts`**

1. **Log the actual Google token error** — After the token refresh call, log `tokenData` when it fails so we can see the real error (e.g., `invalid_grant`)
2. **Add `From: ai@rebar.shop`** to the raw email RFC 2822 headers
3. **Change subject** to `ERP | Rebar.shop | {lead_title}`
4. **Redeploy** the function after changes

| File | Change |
|---|---|
| `supabase/functions/notify-lead-assignees/index.ts` | Log token error details, add From header, update subject format |
| Deploy | Redeploy `notify-lead-assignees` |

