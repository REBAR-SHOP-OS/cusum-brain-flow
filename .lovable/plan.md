

# Fix: Vizzy Time Inconsistency + Social Media Realtime Collision

## Issue 1: Vizzy Says Different Time Each Session

**Root cause**: `useVizzyVoiceEngine.ts` uses a `contextFetched` ref that is set to `true` on the first voice session and never reset. On subsequent sessions, the time context from the original session is reused (stale). The AI model receives "It is currently morning ... 7:42 AM" from the first session even if it's now afternoon.

**Fix in `src/hooks/useVizzyVoiceEngine.ts`**:
- Always rebuild the time context portion of instructions before each session start, even if `contextFetched.current` is already true
- When `contextFetched` is true and the user starts a new session, update the time context in `instructionsRef.current` using `getTimeContextInTimezone(timezone)` before calling `originalStartSession()`
- This ensures every voice session gets the current time, not a cached one from hours ago

**Additional fix in `supabase/functions/daily-team-report/index.ts`**:
- Replace `new Date().toISOString().split("T")[0]` with timezone-aware date using `getWorkspaceTimezone`
- Replace hardcoded `T00:00:00.000Z` / `T23:59:59.999Z` with computed UTC boundaries

## Issue 2: Social Media Realtime Collision

**Root cause**: `useSocialApprovals.ts` uses a static channel name `"social_approvals_realtime"`. When `SocialMediaManager` mounts both `useSocialPosts` (already fixed with UUID) and `useSocialApprovals` (still static), and the `ApprovalsPanel` also calls `useSocialApprovals`, channel collisions can cause the realtime subscription to fail silently, preventing data refresh.

**Fix in `src/hooks/useSocialApprovals.ts`**:
- Change channel name from `"social_approvals_realtime"` to `` `social_approvals_realtime_${crypto.randomUUID()}` `` (same pattern applied to all other hooks)

## Files Changed

| File | Change |
|------|--------|
| `src/hooks/useVizzyVoiceEngine.ts` | Refresh time context on every session start, not just the first |
| `src/hooks/useSocialApprovals.ts` | Unique channel name with UUID |
| `supabase/functions/daily-team-report/index.ts` | Timezone-aware date boundaries |

## Safety
- No database changes
- No schema changes
- Minimal code changes following established patterns

