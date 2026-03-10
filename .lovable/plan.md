

# Audit: Scheduled Posts Not Publishing — Root Cause Analysis

## What I Found

After a full audit of the database, edge functions, cron logs, and frontend code, here is the chain of failures:

### 1. No Scheduled Posts Exist in the Database
The database currently has **zero posts with `status=scheduled`**. The 25 posts in the DB are split between:
- 21 × `status=draft, qa_status=needs_review`
- 4 × `status=published, qa_status=needs_review`

The posts you see on the calendar for March 10 likely show `scheduled_date` values from auto-generation, but they were never promoted to `status=scheduled`. The cron correctly reports "0 posts" every minute because there is nothing to publish.

### 2. `schedule-post` Edge Function Has No Logs
The function that should update posts to `status=scheduled` has **zero log entries** — not even boot logs. This means it either fails to deploy or crashes at import time. This is the critical failure: when you click "Schedule" in the UI, the edge function is silently failing, so the post never transitions from `draft`/`pending_approval` to `scheduled`.

### 3. Timezone Bug in Auto-Generate
The `buildScheduledDate` function treats time slots (6:30, 7:30, 8:00, etc.) as **UTC hours**, but they are intended for **Eastern Time (America/Toronto)**. A "6:30 AM" post actually gets scheduled for 6:30 UTC = **2:30 AM Eastern** — 4 hours too early.

```text
Flow that should work:
  Auto-generate → status: pending_approval
  User clicks Schedule → schedule-post edge fn → status: scheduled
  Cron runs every minute → finds status=scheduled & past due → publishes

What's happening:
  Auto-generate → status: pending_approval ✅
  User clicks Schedule → schedule-post SILENTLY FAILS ❌ (no logs)
  Cron runs → finds 0 scheduled posts → does nothing ✅ (correct behavior)
```

## Fix Plan

### Fix 1: Redeploy `schedule-post` Edge Function
Force redeploy to get it running. Verify it boots and produces logs.

### Fix 2: Fix Timezone in `auto-generate-post`
Update `buildScheduledDate` to create Eastern Time dates instead of UTC:

```typescript
function buildScheduledDate(baseDate: string, hour: number, minute: number): string {
  // Create date string in Eastern time, then convert to UTC ISO
  const d = new Date(baseDate);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const eastern = new Date(
    `${year}-${month}-${day}T${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")}:00-04:00`
  );
  return eastern.toISOString();
}
```

### Fix 3: Add Fallback Direct-Update in Frontend
If the `schedule-post` edge function fails, fall back to a direct database update in `schedulePost.ts` so scheduling isn't silently swallowed.

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/auto-generate-post/index.ts` | Fix `buildScheduledDate` timezone |
| `src/lib/schedulePost.ts` | Add fallback direct DB update if edge function fails |
| Deploy action | Force redeploy `schedule-post` |

