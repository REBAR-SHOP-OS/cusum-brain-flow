

## Fix: "Today's Deliveries" count mismatch on /deliveries page

### Root Cause
The `scheduled_date` field is a `timestamptz` column, so its value comes back from the database as a full ISO string like `"2026-02-23T00:00:00+00:00"`. The filtering logic compares this full string directly against a plain date string `"2026-02-23"`:

```text
"2026-02-23T00:00:00+00:00" > "2026-02-23"  -->  TRUE  (wrong!)
```

Because the full ISO string is longer and the `T` character makes it "greater" in a string comparison, **today's deliveries are incorrectly counted as "Upcoming"** as well. This double-counting inflates the Upcoming number and can cause the Today tab to appear empty depending on which tab is selected.

### Fix (1 file, 2 lines)

**File: `src/pages/Deliveries.tsx`**

Normalize `scheduled_date` to just the date portion before comparing:

```typescript
// Line 181-183 (Today filter) — already correct, startsWith handles it
const todayDeliveries = filteredDeliveries.filter(d => 
  d.scheduled_date?.startsWith(today)
);

// Line 185-187 (Upcoming filter) — FIX: compare only date part
const upcomingDeliveries = filteredDeliveries.filter(d => {
  const dateOnly = d.scheduled_date?.split("T")[0];
  return dateOnly && dateOnly > today;
});
```

### Result
- "Today" tab will correctly show deliveries scheduled for today
- "Upcoming" tab will only show deliveries scheduled for future dates (not today)
- No double-counting between tabs

