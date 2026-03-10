
# Fix: Exempt Shop Workers from 5 PM Auto Clock-Out

## Problem
The `auto-clockout` edge function closes ALL open shifts at both 8 AM (morning reset) and 5 PM (evening). Shop workers (non-`@rebar.shop` emails + Kourosh Zand) should NOT be auto-clocked out at 5 PM because they work variable hours and must clock out manually.

## Current Logic
- **Office** = email ends with `@rebar.shop` AND not "Kourosh Zand"
- **Shop** = everyone else with a `user_id` (non-`@rebar.shop` emails OR Kourosh Zand)
- Auto-clockout closes ALL open shifts indiscriminately

## Fix

### File: `supabase/functions/auto-clockout/index.ts`

**Evening mode only** (lines 94-136): Before closing shifts, join open shifts with profiles to get emails, then filter out shop workers.

```
Evening mode change:
1. Fetch open shifts WITH profile email (join profiles table)
2. Filter: only close shifts where profile email ends with '@rebar.shop' 
   AND full_name != 'Kourosh Zand'
3. Skip shop worker shifts entirely
4. Log how many shop workers were exempted
```

**Morning mode** (8 AM reset): Keep closing ALL shifts — this is a safety reset for stale overnight shifts regardless of role.

### No frontend changes needed
The Team Status Shop tab already shows shop workers correctly. The only fix is in the backend auto-clockout logic.

## Expected Behavior
| Time | Office workers | Shop workers |
|------|---------------|--------------|
| 8 AM morning reset | Auto-closed (safety) | Auto-closed (safety) |
| 5 PM evening | Auto-closed | **NOT touched** — must clock out manually |
| Manual clock out | Anytime | Anytime |
