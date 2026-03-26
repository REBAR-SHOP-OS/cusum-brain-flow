

# Fix: Lead Email Notifications Not Sending

## Root Cause

The `notify-lead-assignees` Edge Function has a **profiles.id vs profiles.user_id mismatch** bug in multiple places. The `user_gmail_tokens` table stores tokens keyed by `user_id` (which equals `auth.users.id` = `profiles.user_id`), but the code queries it using `profiles.id` — a completely different UUID.

**Example:**
- `profiles` for ai@rebar.shop: `id = 6a0831f0...`, `user_id = b2b75b2e...`
- `user_gmail_tokens` for ai@rebar.shop: `user_id = b2b75b2e...`
- Code does: `.eq("user_id", aiProfile.id)` → looks for `6a0831f0...` → finds nothing → no token → no email sent

This affects all 3 Gmail token lookup paths (actor fallback to ai@, admin fallback, second admin fallback), so **no emails can ever be sent via the ai@ or admin fallback paths**.

## Fix

### `supabase/functions/notify-lead-assignees/index.ts`

**4 changes:**

1. **Line 243-244** — ai@rebar.shop lookup: select `user_id` too, then use it for token query
   ```typescript
   .select("id, user_id")  // was: .select("id")
   ```

2. **Line 250** — token query for ai@:
   ```typescript
   .eq("user_id", aiProfile.user_id)  // was: aiProfile.id
   ```

3. **Line 290** — admin fallback profile lookup:
   ```typescript
   .eq("user_id", candidate.user_id)  // was: .eq("id", candidate.user_id)
   ```

4. **Line 332** — second ai@ fallback:
   ```typescript
   .select("id, user_id")  // was: .select("id")
   ```
   And line 334:
   ```typescript
   .eq("user_id", aiProfile.user_id)  // was: aiProfile.id
   ```

5. **Line 355** — second admin fallback profile lookup:
   ```typescript
   .eq("user_id", candidate.user_id)  // was: .eq("user_id", candidate.user_id) — already correct here
   ```

After fixing, redeploy the Edge Function.

| File | Change |
|---|---|
| `notify-lead-assignees/index.ts` | Fix profiles.id → profiles.user_id mismatches in Gmail token lookups |

