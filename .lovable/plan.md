

# Fix "System Performance Overview" Showing No Data

## Root Cause

The `actor_id` column in `activity_events` stores the **user_id** (from `auth.users`), NOT the **profile_id** (from `profiles`). But both `useUserActivityLog` and `useUserPerformance` query `actor_id` using `profileId` — so they never match any rows.

For example, Radin's profile_id is `5d948a66-...` but his activity events are stored under actor_id `be3b9444-...` (his user_id). The query `.eq("actor_id", profileId)` returns 0 results.

## Fix

### 1. `src/hooks/useUserActivityLog.ts`
- Accept both `profileId` and `userId` as parameters
- Query `actor_id` using `userId` instead of `profileId`

### 2. `src/hooks/useUserPerformance.ts`
- The activity_events count query on line 53 already receives `userId` as a parameter but incorrectly uses `profileId` for `actor_id`
- Change `.eq("actor_id", profileId!)` to `.eq("actor_id", userId!)` (with a guard for null)

### 3. `src/components/vizzy/VizzyBrainPanel.tsx`
- Update `UserActivitySection` to also pass `userId` (from `selectedProfile.user_id`) to `useUserActivityLog`
- The component already has access to `selectedProfile.user_id`

## Summary

| File | Change |
|------|--------|
| `useUserActivityLog.ts` | Accept `userId`, query `actor_id` with it |
| `useUserPerformance.ts` | Fix activity count to use `userId` for `actor_id` |
| `VizzyBrainPanel.tsx` | Pass `selectedProfile.user_id` to `UserActivitySection` |

Three files, minimal changes. Fixes the ID mismatch that causes "No activities recorded today."

