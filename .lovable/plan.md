

# Remove Ryle Lachini from System

## Current State
- Profile `d950f825-adf4-418f-a4c3-44562631e1c8` exists with email `deleted_d950f825@removed.invalid` (already partially deactivated)
- No `user_id` linked (no auth account)
- Only 2 old `time_clock_entries` from Feb 11 exist — no other data
- Referenced in 4 code files as hardcoded text

## Plan

### 1. Database cleanup (via insert tool)
- DELETE the 2 `time_clock_entries` for this profile
- DELETE the `profiles` row

### 2. Code cleanup (4 files)

| File | Change |
|------|--------|
| `supabase/functions/_shared/vizzyIdentity.ts` | Remove "Ryle Lachini" from name fuzzy-match list |
| `supabase/functions/_shared/vizzyFullContext.ts` | Remove Ryle's phone number mapping |
| `src/hooks/useVizzyVoiceEngine.ts` | Remove "Ryle Lachini" from voice engine name list |
| `src/pages/TimeClock.tsx` | Remove "Ryle Lachini" from the `activeProfiles` exclusion filter (no longer needed) |

### Technical Notes
- No foreign key constraints will block deletion since `user_id` is null and only 2 clock entries exist
- The TimeClock filter already excludes Ryle — after profile deletion the filter entry becomes dead code and should be removed for cleanliness

