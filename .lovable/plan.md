

# Cap Idle Timer at 5 Minutes

## Problem
The idle timer on the Live Monitor banner keeps counting indefinitely (e.g., "CUTTER-01 idle for 1212+ min"). After 5 minutes of idle, the exact count is meaningless — it should cap at 5 min and say "paused" or "idle since [time]" until the next action.

## Change

**File: `src/components/shopfloor/DowntimeAlertBanner.tsx`**

1. Cap the displayed idle time at 5 minutes
2. When idle exceeds 5 min, show "idle – paused since [last event time]" instead of a running counter
3. Keep the 30-min threshold for showing the banner at all

```text
Before:  "CUTTER-01 idle for 1212+ min"
After:   "CUTTER-01 idle – paused since 11:48 PM"
```

For machines idle between 30 min and 5 min (won't show — threshold is 30 min), this change only affects display, not filtering logic.

### Implementation
- Modify the idle machine render block: if `minutesSince > 5`, display the last event timestamp formatted as a time (e.g., "11:48 PM") with "paused since" label
- If `minutesSince <= 5`, show the normal "idle for X min" text (though this won't appear due to the 30-min filter)

**Result**: The banner shows a meaningful "paused since [time]" instead of an ever-growing minute counter, making it clear the machine has been idle and when it last had activity.

