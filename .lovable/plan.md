

# Fix: Profile Lookup Bug in notify-lead-assignees

## Investigation Summary

**Good news**: The latest deployment IS working. At 13:01 UTC, sattar logged "@Neel Mahajan hi yoyo" and emails were successfully sent to neel@rebar.shop, ben@rebar.shop, and ali@epcdesignbuild.ca.

**The failed request at 12:59** was neel logging a note — this ran against the OLD code (before the actor-token-lookup fix was deployed), which fell to the expired admin fallback token → `invalid_grant`. No emails were sent for that request.

## Remaining Bug

There is a `profiles` table lookup bug. The table has two ID columns:
- `profiles.id` — internal profile ID (e.g., `ee659c5c` for sattar)
- `profiles.user_id` — auth user ID (e.g., `c9b3adc2` for sattar)

The function receives `actor_id` = auth user ID, but queries `profiles` using `.eq("id", actor_id)` instead of `.eq("user_id", actor_id)`. This causes:

1. **Actor email never resolves** → actor is never excluded from recipients (they get emails about their own actions)
2. **Sender email defaults to "ai@rebar.shop"** in logs even when using actor's token

## Fix

### `supabase/functions/notify-lead-assignees/index.ts`

Two lines need changing:

**Line 47**: Actor email lookup
```
// FROM:  .eq("id", actor_id)
// TO:    .eq("user_id", actor_id)
```

**Line 168**: Sender email lookup  
```
// FROM:  .eq("id", actor_id)
// TO:    .eq("user_id", actor_id)
```

This ensures:
- Actor is correctly excluded from recipients (no self-notifications)
- Email "From" header shows the correct sender email in logs

| File | Change |
|---|---|
| `supabase/functions/notify-lead-assignees/index.ts` | Fix two `profiles` queries to use `user_id` instead of `id` |

