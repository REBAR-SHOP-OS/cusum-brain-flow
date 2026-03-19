

# Fix Vizzy Voice Integration with Gmail & RingCentral

## Problem Summary

Two root causes prevent Vizzy from working properly:

**Issue 1 — Vizzy's responses are silently dropped (PRIMARY)**
The `isSelfTalk()` filter in `useVoiceEngine.ts` (lines 81-88) contains a language-mismatch rule designed for the Azin *translator*. It blocks any agent response that's in the *same* language as the user. Since Vizzy is a conversational assistant who should reply in the same language, nearly **all** of her responses are filtered out before rendering. This is why the screenshot shows only "YOU" bubbles.

Additionally, the self-talk pattern list (lines 48-62) is extremely aggressive — it blocks phrases like "sure", "got it", "I can", "I will", "let me", which are all legitimate Vizzy responses.

**Issue 2 — RingCentral never writes to `integration_connections`**
The `ringcentral-oauth` edge function saves tokens to `user_ringcentral_tokens` but **never creates a row** in `integration_connections`. Gmail does this (line 183-196 of google-oauth). Without this row, the Integrations page shows RingCentral as disconnected, and Vizzy's context builder can't detect the connection.

## Evidence

- `curl google-oauth check-status` → `{"status":"connected","email":"sattar@rebar.shop"}` ✓
- `curl ringcentral-oauth check-status` → `{"status":"connected","email":"Sattar@rebar.shop"}` ✓
- `integration_connections` table has Gmail rows but **zero RingCentral rows**
- `user_ringcentral_tokens` has valid token (expires 2026-03-19 23:07)
- Voice transcript shows all "YOU" messages, no "VIZZY" messages → filter is dropping them

## Fix Plan

### Step 1 — Remove language-mismatch filter for non-translation use

**File: `src/hooks/useVoiceEngine.ts`**

- Add `translationMode?: boolean` to `VoiceEngineConfig` (default `false`)
- Pass `translationMode` into `isSelfTalk` calls
- Only apply the language-mismatch check (lines 82-88) when `translationMode === true`
- Keep echo detection and empty-text filters active for all modes

### Step 2 — Reduce aggressive self-talk patterns for assistant mode

**File: `src/hooks/useVoiceEngine.ts`**

- Split patterns into two groups: `ALWAYS_FILTER` (empty, dots, single fillers) and `TRANSLATION_ONLY_FILTER` (conversational phrases like "sure", "I can", etc.)
- Only apply `TRANSLATION_ONLY_FILTER` when `translationMode === true`
- This allows Vizzy to say things like "Got it, let me check your emails" without being blocked

### Step 3 — Write RingCentral status to `integration_connections`

**File: `supabase/functions/ringcentral-oauth/index.ts`**

- In the `handleOAuthCallback` function (after saving tokens, around line 385), add an upsert to `integration_connections` with `integration_id: "ringcentral"`, `status: "connected"`, same pattern as google-oauth
- In the `check-status` action (around line 132), when returning "connected", also upsert the integration_connections row
- In the `disconnect` action (around line 263), also delete the `integration_connections` row for ringcentral

### Step 4 — Deploy updated edge function

Deploy `ringcentral-oauth` so the fix takes effect immediately.

## Files to Modify

1. `src/hooks/useVoiceEngine.ts` — add `translationMode` flag, split filter patterns
2. `supabase/functions/ringcentral-oauth/index.ts` — write/clean `integration_connections`

## Expected Outcome

- Vizzy's voice responses will appear in the transcript instead of being silently dropped
- RingCentral will show as "Connected" on the Integrations page
- Vizzy's context will correctly detect both Gmail and RingCentral as active integrations

