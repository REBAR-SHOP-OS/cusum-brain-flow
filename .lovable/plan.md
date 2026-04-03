

# Fix: Timezone Consistency Across Vizzy and Backend

## Problem
The `vizzyFullContext.ts` file correctly resolves the workspace timezone (`tz`) and computes `today` as a timezone-aware date string (e.g., `2026-04-03`). However, it then misuses this value in two critical ways:

1. **Query filters**: Uses `today + "T00:00:00"` (e.g., `2026-04-03T00:00:00`) which PostgreSQL interprets as **UTC midnight**, not midnight in the business timezone. This means queries miss late-night activity or include next-day activity depending on offset.

2. **Time formatting**: All `toLocaleTimeString()` and `toLocaleDateString()` calls (~15 instances) omit the `timeZone` option, so they format using the **server's UTC timezone** — making Vizzy report "3:00 AM" when it's actually "11:00 PM ET".

## Root Cause
The `tz` variable is available but never passed to any formatting or filter construction after the initial `today` calculation.

## Fix

### 1. Compute timezone-aware ISO boundaries (vizzyFullContext.ts)
After computing `today` (line 19-24), compute the actual UTC offset boundaries:

```typescript
// today = "2026-04-03" (in workspace tz)
// Compute UTC equivalent of midnight in workspace tz
const todayStartUTC = new Date(
  new Date().toLocaleString("en-US", { timeZone: tz })
).toISOString().replace(/T.*/, "T00:00:00");
// Better approach: use Intl to get offset, then compute proper UTC start
const todayMidnight = new Date(`${today}T00:00:00`);
// Shift by tz offset to get true UTC start of the business day
```

Actually, the cleanest approach: compute the offset between UTC and workspace tz, then shift all filter boundaries accordingly.

**Concrete implementation**: Create a helper `tzMidnight(dateStr, tz)` that returns the UTC ISO string corresponding to midnight of `dateStr` in timezone `tz`. Replace all `today + "T00:00:00"` with this value.

### 2. Add `timeZone: tz` to all formatting calls (~15 locations)
Every `toLocaleTimeString("en-US", {...})` and `toLocaleDateString("en-US", {...})` call needs `timeZone: tz` added to its options.

Key locations (line numbers):
- Line 340: `fmtTime` helper — add `timeZone: tz` 
- Line 385: email date formatting
- Line 428: memory expiry date
- Line 626-627: employee first/last action times
- Line 667: email time
- Line 746: RC call time
- Line 826: snapshot timestamp
- Line 935: call note time
- Line 994: voicemail time
- Line 1012: call summary time
- Line 1027: human task created date

### 3. Fix the snapshot header (line 826)
Change `new Date().toLocaleString()` to `new Date().toLocaleString("en-US", { timeZone: tz })`.

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/_shared/vizzyFullContext.ts` | Add `todayStart` UTC-aware boundary; pass `timeZone: tz` to all ~15 formatting calls |

## Impact
- Vizzy will report correct local times (e.g., "11:00 PM" instead of "3:00 AM")
- "Today" queries will correctly capture all business-day activity
- No database or schema changes needed
- No changes to frontend — this is purely backend context generation

