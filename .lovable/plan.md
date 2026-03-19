

# Give Vizzy Full RingCentral Access via Tools

## What This Does

Adds RingCentral action tools to Vizzy's (admin-chat) tool suite so she can make calls, send SMS/fax, check active calls, get team presence, and pull call analytics — all from the chat or voice interface, without the super-admin email restriction.

## Current State

- RingCentral edge functions exist (`ringcentral-action`, `ringcentral-active-calls`, `ringcentral-fax-send`, `ringcentral-presence`, `ringcentral-call-analytics`) but they are standalone functions locked behind `SUPER_ADMIN_EMAILS = ["sattar@rebar.shop"]`
- Vizzy (admin-chat) has tools for ERP, WordPress, email, memory — but ZERO RingCentral tools
- The voice engine (`useVizzyVoiceEngine.ts`) mentions RC tools in memory docs but they don't actually exist in the code

## Plan

### Step 1 — Add RingCentral Tool Definitions to admin-chat

**File: `supabase/functions/admin-chat/index.ts`**

Add 6 new tool definitions to `JARVIS_TOOLS`:

1. **`rc_make_call`** — Initiate a RingOut call to a phone number
2. **`rc_send_sms`** — Send an SMS message to a phone number
3. **`rc_send_fax`** — Send a fax to a phone number
4. **`rc_get_active_calls`** — Get currently active calls on the company's RC account
5. **`rc_get_team_presence`** — Get DND/availability status of all RC extensions
6. **`rc_get_call_analytics`** — Pull call analytics (total calls, per-employee breakdown, missed calls)

Add `rc_make_call`, `rc_send_sms`, `rc_send_fax` to the `WRITE_TOOLS` set (require confirmation).

### Step 2 — Implement RC Tool Execution in admin-chat

**File: `supabase/functions/admin-chat/index.ts`**

Add a helper function to get a valid RC access token (reuse the token refresh pattern from `ringcentral-action`). Then implement execution for each tool:

- **Read tools** (in `executeReadTool`):
  - `rc_get_active_calls` — Call RC API `/restapi/v1.0/account/~/extension/~/active-calls?view=Detailed`
  - `rc_get_team_presence` — Call RC API `/restapi/v1.0/account/~/extension/~/presence`
  - `rc_get_call_analytics` — Query `communications` table for RC calls with date filters, aggregate per-employee

- **Write tools** (in `executeWriteTool`):
  - `rc_make_call` — Call RC RingOut API
  - `rc_send_sms` — Call RC SMS API
  - `rc_send_fax` — Call RC Fax API

All RC API calls use the company's RC token (from `user_ringcentral_tokens`), not the requesting user's personal token — since this is an admin-level capability.

### Step 3 — Update Voice Engine Prompt

**File: `src/hooks/useVizzyVoiceEngine.ts`**

Add a section documenting Vizzy's RC capabilities:
- "You can make calls, send SMS, send faxes, check active calls, and see team presence via RingCentral"
- For voice: use `[VIZZY-ACTION]{"type":"rc_make_call","phone":"+1..."}[/VIZZY-ACTION]` pattern
- For text chat: tools are called natively via the function-calling API

### Step 4 — Deploy

Deploy `admin-chat` edge function to apply changes.

## Files Modified
1. `supabase/functions/admin-chat/index.ts` — Add 6 RC tools + execution logic + token helper
2. `src/hooks/useVizzyVoiceEngine.ts` — Add RC capability documentation to prompt

## Security
- All RC tools remain gated behind admin-chat's existing admin role check (line 1207-1219)
- Write tools (call, SMS, fax) require user confirmation via the existing confirmation flow
- No changes to the standalone RC edge functions — they continue to work independently

