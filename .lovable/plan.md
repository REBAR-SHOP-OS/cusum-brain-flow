

# Turn Overdue "Scheduled + Approved" Cards Red

## Problem
Posts that are approved and scheduled but missed their publish window (scheduled time is in the past) still show as green "Scheduled · Approved". They should turn red to flag them as overdue/missed.

## Fix

### File: `src/components/social/SocialCalendar.tsx`

Add an `isOverdue` flag per post:

```typescript
const isOverdue = status === "scheduled" && isApproved
  && post.scheduled_date && new Date(post.scheduled_date) < new Date();
```

Then update three places:

1. **Card background** (line 277-278): Insert `isOverdue` check before the normal scheduled+approved branch:
   - `isOverdue` → `"bg-red-500/10 border-red-500/40"` (same as failed)
   - else scheduled+approved → keep existing green

2. **Status text color** (line 333): Insert `isOverdue` check:
   - `isOverdue` → `"text-red-600 font-medium"`

3. **Status label** (line 342-343): Insert `isOverdue` check:
   - `isOverdue` → `"Overdue · Not Published"` (or `"Missed · Not Published"`)

No database, migration, or hook changes needed. Pure UI logic — one file, ~6 lines added.

