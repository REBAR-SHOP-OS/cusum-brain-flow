
Fix Chat Vizzy’s RingCentral analytics/runtime bug

What’s actually wrong:
- The Vite output shown is not the real failure; the frontend build is succeeding.
- The real issue is in Chat Vizzy’s backend tool execution.
- I confirmed `admin-chat` is querying non-existent `communications` columns:
  - `channel`
  - `duration`
  - `missed`
  - `employee_name`
- The actual `communications` table stores call details in `metadata` and identifies RingCentral records with `source = "ringcentral"`.
- I also found a second backend bug in `admin-chat`: the SSE stream is being closed multiple times, which matches the edge logs:
  - `TypeError: The associated stream is already closing`

Implementation plan

1. Fix `rc_get_call_analytics` in `supabase/functions/admin-chat/index.ts`
- Replace the broken query:
  - remove `.eq("channel", "phone")`
  - stop selecting `duration`, `missed`, `employee_name`
- Query fields that really exist:
  - `user_id`, `company_id`, `source`, `direction`, `from_address`, `to_address`, `received_at`, `metadata`
- Filter RingCentral calls correctly:
  - `source = "ringcentral"`
  - then filter rows where `metadata.type === "call"`
- Derive analytics from `metadata`:
  - duration from `metadata.duration`
  - missed from `metadata.result === "Missed"` or `"No Answer"`
  - outcome distribution from `metadata.result`

2. Restore per-employee breakdown properly
- Use each communication row’s `user_id`
- Load matching `profiles.full_name` for those users
- Build `byEmployee` from the profile name map instead of the fake `employee_name` column
- Keep “Unknown” fallback if a profile is missing

3. Keep the tool contract aligned with how Vizzy uses it
- Preserve support for:
  - `date`
  - `days`
- Make sure the returned JSON still includes:
  - period
  - summary
  - byEmployee
- This avoids needing prompt changes elsewhere unless the response shape changed

4. Fix the `admin-chat` stream lifecycle bug
- Refactor the SSE writer closing flow so it only closes once
- Add a single guarded close helper (for example, a `closed` boolean)
- Replace repeated `writer.close()` calls and make the `finally` block idempotent
- This should remove the `associated stream is already closing` crashes seen in logs

5. Validate the fix end-to-end
- Test the `admin-chat` function directly with the RingCentral analytics tool path
- Confirm:
  - no “column does not exist” errors
  - no double-close stream error in logs
  - Chat Vizzy returns analytics normally in the `/chat` UI
- If analytics still look incomplete, verify the synced call rows exist and that `metadata.type = "call"` is present in recent records

Files to update
- `supabase/functions/admin-chat/index.ts`

Technical details
- Confirmed schema:
  - `communications` has `source`, `source_id`, `direction`, `from_address`, `to_address`, `metadata`, `received_at`, `user_id`, `company_id`
  - it does not have `channel`, `duration`, `missed`, or `employee_name`
- Confirmed working pattern elsewhere:
  - `ringcentral-call-analytics` already reads from `communications` and extracts `duration`/`result` from `metadata`
  - `vizzy-context` also computes call stats from `metadata.type`, `metadata.duration`, and `metadata.result`
- Confirmed runtime log issue:
  - `admin-chat` has multiple `writer.close()` paths plus a `finally` close, which explains the stream error

Expected outcome
- Chat Vizzy stops telling users the database is missing `communications.duration`
- RingCentral call analytics works inside chat
- The `admin-chat` function stops throwing stream-closing runtime errors
