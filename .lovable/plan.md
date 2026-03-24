

## Fix Notification Emails: Token Refresh, From Address & Subject

### Changes

**File: `supabase/functions/notify-lead-assignees/index.ts`**

1. **Log token error details** — After the token refresh call, log `tokenData` when `access_token` is missing so we can diagnose the real Google error (e.g., `invalid_grant`)
2. **Add `From: ai@rebar.shop`** to the raw RFC 2822 email headers
3. **Change subject** from `[Rebar.shop] Lead Update: {title}` to `ERP | Rebar.shop | {lead_title}`
4. **Redeploy** the function

| File | Change |
|---|---|
| `notify-lead-assignees/index.ts` | Log token error, add From header, update subject |
| Deploy | Redeploy edge function |

