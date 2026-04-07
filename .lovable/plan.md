

# Fix: Team Daily Report Shows 0 Activities

## Root Cause
The `activityLogger.ts` stores the **auth user ID** (`auth.uid()`) as `actor_id` in `activity_events`. However, `useTeamDailyActivity` filters activities using `.in("actor_id", profileIds)` where `profileIds` are the **profile table IDs** — a different UUID.

Since `profiles.id ≠ profiles.user_id`, the filter never matches any rows, resulting in 0 activities for every employee.

## Fix

### `src/hooks/useTeamDailyActivity.ts`
Instead of filtering by `profileIds`, build a map of `user_id → profile_id` from the profiles passed in, then filter the activity query by user IDs (which match `actor_id`).

**Changes:**
1. Accept the full profiles array (with `user_id`) instead of just IDs
2. Extract `userIds` from profiles for the activity query filter
3. Map results back to profile IDs using the `userId → profileId` mapping
4. Keep `time_clock_entries` query using `profile_id` as before (that table uses profile IDs)

### `src/components/vizzy/VizzyBrainPanel.tsx`
Update the call to `useTeamDailyActivity` to pass the full `profiles` array instead of just `profileIds`.

## Impact
- Two files changed
- No database changes needed
- Activities that are already logged will immediately appear in the Team Daily Report

