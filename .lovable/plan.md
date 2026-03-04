

# Investigation Results: Clearance Page Label Limit

## Finding
After thorough investigation, **there is no `.limit(5)` or any artificial row cap** in the clearance data fetching code.

The `useClearanceData` hook (`src/hooks/useClearanceData.ts`) fetches all `cut_plan_items` where `phase = "clearance"` without any limit. The suggested fix from the error report (removing `.limit(5)` from `apiLabels.ts`) does not apply — that file does not exist in this project.

## Database State
The database currently has **zero** items with `phase = "clearance"`:

```text
phase        | count
-------------|------
complete     | 13
cut_done     | 2
queued       | 4
clearance    | 0
```

The screenshot shows 5 items — this is simply the total number of items that were in the clearance phase at that time, not a limit.

## Possible Real Issues
If users report missing items in the future, the likely causes would be:
1. Items haven't been moved to the `clearance` phase yet (they're still in `cut_done`, `bending`, etc.)
2. Items belong to a different `company_id` than the logged-in user's company
3. RLS policies blocking visibility

## Recommendation
**No code change is needed.** The clearance query already fetches all matching items without limits. If specific items are missing, the investigation should focus on whether those items have `phase = "clearance"` set correctly in the database.

