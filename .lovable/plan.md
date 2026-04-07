

# Fix: Vizzy Still Hallucinating Clock-In Data — Names Missing from FACTS Block

## Root Cause

The `[FACTS]` block in `vizzyFullContext.ts` (line 849) only outputs **numbers**:
```
[FACTS] staff=9, clocked_in=5, clocked_out_today=3, absent=4, ...
```

The actual **names** of who clocked in vs who is absent are listed much later in a TEAM PRESENCE section. The AI model (both the pre-digest Gemini and the OpenAI Realtime voice model) sees `staff=9` and when asked "how many people clocked in", it reports 9 — then invents a full list of all employees.

The fix: **Add explicit name lists to the FACTS block** so the ground-truth anchor includes WHO, not just counts.

## Changes

### File: `supabase/functions/_shared/vizzyFullContext.ts`

**Change the FACTS block** (line 849) to include names:

```typescript
const clockedInNames = onNow.map((t: any) => profileIdMap.get(t.profile_id) || "Unknown").join(", ");
const clockedOutNames = doneToday.map((t: any) => profileIdMap.get(t.profile_id) || "Unknown").join(", ");
const absentNames = absentProfiles.map((p: any) => p.full_name || "Unknown").join(", ");

const factsBlock = `[FACTS] staff=${totalStaff}, clocked_in=${clockedInCount}, clocked_out_today=${clockedOutTodayCount}, absent=${absentCount}, ...
clocked_in_names=[${clockedInNames || "none"}]
clocked_out_names=[${clockedOutNames || "none"}]
absent_names=[${absentNames || "none"}]
[/FACTS]
STAFF PRESENCE: ${clockedInCount} currently clocked in, ${clockedOutTodayCount} clocked out today, ${absentCount} absent, ${totalStaff} total registered staff`;
```

This ensures the FACTS block — which both the pre-digest prompt and voice instructions reference as the authoritative anchor — contains the exact names. The model can no longer guess.

### File: `src/hooks/useVizzyVoiceEngine.ts`

**Strengthen the TEAM & PRESENCE QUERIES rule** (line 163-166) to explicitly reference the named lists:

Add after line 166:
```
5. "How many clocked in?" = use clocked_in number AND clocked_in_names from [FACTS]. ONLY list names that appear in clocked_in_names. If a name is in absent_names, they did NOT clock in — do NOT include them.
6. If total in clocked_in_names < staff count, the difference is ABSENT. Say exactly who is absent using absent_names.
```

## Files Changed
| File | Change |
|------|--------|
| `supabase/functions/_shared/vizzyFullContext.ts` | Add name lists to FACTS block |
| `src/hooks/useVizzyVoiceEngine.ts` | Strengthen presence query rules to reference named FACTS |

