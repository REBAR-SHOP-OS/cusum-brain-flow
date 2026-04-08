

# Enhance Time Clock Section with Detailed Clock-In/Out Report

## Problem
The `UserTimeClockSection` component doesn't pass the selected date to `useUserPerformance`, so it always shows today's data. Also, the section needs more detail: break minutes, notes, and a total hours summary.

## Changes

### 1. `src/components/vizzy/VizzyBrainPanel.tsx`

**Update `UserTimeClockSection`:**
- Accept a `date` prop and pass it to `useUserPerformance(profileId, userId, date)`
- Add a total hours summary row at the bottom
- Fetch `break_minutes` and `notes` from the clock entries and display them
- Show status badge: "Still working" for open shifts, duration for closed

**Update the call site (line ~1437):**
- Pass `date={userSelectedDate}` to `UserTimeClockSection`

### 2. `src/hooks/useUserPerformance.ts`

**Expand `ClockEntry` interface** to include `break_minutes` and `notes`:
```typescript
export interface ClockEntry {
  clock_in: string;
  clock_out: string | null;
  break_minutes: number;
  notes: string | null;
}
```

**Update the query** to select these additional fields:
```sql
select("clock_in, clock_out, break_minutes, notes")
```

### 3. Enhanced UI layout

Each entry row will show:
- Clock-in time (green icon)
- Arrow → Clock-out time (red icon) or "Still working" badge
- Break minutes (if > 0)
- Net hours worked
- Notes (if present, shown as small muted text below)

Bottom summary row:
- Total gross hours
- Total break time
- Total net hours

| File | Action |
|------|--------|
| `src/hooks/useUserPerformance.ts` | Add `break_minutes`, `notes` to ClockEntry and query |
| `src/components/vizzy/VizzyBrainPanel.tsx` | Pass date prop, show detailed entries with totals |

