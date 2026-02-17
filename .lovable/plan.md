

# Fix: Activity Status Bar, Sorting, and Clickable Filtering

## Current Problem
The column header bar currently shows **priority distribution** (green=3 stars, orange=2 stars, red=0-1 stars). Odoo shows **activity status distribution** instead:
- **Green**: Planned activities (future deadline)
- **Yellow/Orange**: Due today
- **Red**: Overdue (past deadline)
- **Grey**: No activity scheduled

Additionally, leads are sorted by priority stars only. Odoo sorts by activity urgency first.

## What Changes

### 1. Column header bar: Priority to Activity (`PipelineColumn.tsx`)
Replace the priority-based bar segments with activity-based segments:
- Count leads by activity status (overdue / today / planned / none)
- Render 4 color segments: green, yellow, red, grey -- in that exact Odoo order (green first, grey last)
- Each segment is a clickable `button` -- clicking filters the column to show only leads with that activity status
- Clicking the same segment again clears the filter

### 2. Sort leads by activity urgency (`Pipeline.tsx`)
Update the `leadsByStage` sorting to sort by activity status first (overdue > today > planned > none), then by priority stars, then by `updated_at`.

### 3. Column-level activity filter state (`PipelineColumn.tsx`)
Add local state for the active activity filter within each column. When a color segment is clicked, only leads matching that activity status are shown in the card list.

## Technical Details

### Activity status helper (shared logic)
Extract the `getActivityStatus` function to a shared utility or duplicate in PipelineColumn:

```typescript
type ActivityStatus = "overdue" | "today" | "planned" | "none";

function getActivityStatus(lead: Lead): ActivityStatus {
  if (lead.stage === "won" || lead.stage === "lost") return "none";
  if (!lead.expected_close_date) return "none";
  const diff = differenceInDays(new Date(lead.expected_close_date), new Date());
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  return "planned";
}
```

### Bar rendering (PipelineColumn.tsx)
Replace priority bar with clickable activity bar:

```typescript
const [activityFilter, setActivityFilter] = useState<ActivityStatus | null>(null);

const planned = leads.filter(l => getActivityStatus(l) === "planned").length;
const today = leads.filter(l => getActivityStatus(l) === "today").length;
const overdue = leads.filter(l => getActivityStatus(l) === "overdue").length;
const none = total - planned - today - overdue;

// Filter displayed leads
const displayedLeads = activityFilter
  ? leads.filter(l => getActivityStatus(l) === activityFilter)
  : leads;
```

Bar segments are clickable buttons with colors:
- Green (#21b632) for planned
- Yellow (#f0ad4e) for today  
- Red (#d9534f) for overdue
- Grey (muted) for none

### Sorting update (Pipeline.tsx)
In the `leadsByStage` sort function, add activity urgency as the primary sort key:

```typescript
.sort((a, b) => {
  // Activity urgency first: overdue(0) > today(1) > planned(2) > none(3)
  const activityOrder = { overdue: 0, today: 1, planned: 2, none: 3 };
  const aActivity = activityOrder[getActivityStatus(a)];
  const bActivity = activityOrder[getActivityStatus(b)];
  if (aActivity !== bActivity) return aActivity - bActivity;
  
  // Then priority stars
  const starDiff = getStars(b) - getStars(a);
  if (starDiff !== 0) return starDiff;
  
  // Then recency
  return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
});
```

## Files Modified

| File | Change |
|---|---|
| `src/components/pipeline/PipelineColumn.tsx` | Replace priority bar with clickable activity status bar; add local filter state |
| `src/pages/Pipeline.tsx` | Add activity-first sorting in `leadsByStage` |

