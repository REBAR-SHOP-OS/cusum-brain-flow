

## Add Bar List (Scope) Selector to Station View

### Problem
Currently, the station view groups items only by bar size and optionally filters by project name. Items from different bar lists (cut plans) within the same or different projects are mixed together. The user wants each bar list treated as a separate "scope" with a selector to switch between them.

### Solution
Replace the existing project filter pills with a **bar list (scope) selector** that filters by `cut_plan_id`. When a bar list is selected, only items from that specific cut plan are shown. The selector will display the `plan_name` for each scope.

### Changes

**File: `src/pages/StationView.tsx`**

1. Replace the `selectedProject` state and `projectNames` memo with a **bar list selector** based on `cut_plan_id`:
   - Compute distinct bar lists from items: `{ id: cut_plan_id, name: plan_name, projectName: project_name, count: number }`
   - State: `selectedBarListId` (string | null) instead of `selectedProject`
   - Auto-reset if selected bar list disappears

2. Replace the project filter pills UI with bar list pills:
   - "ALL" pill shows total item count
   - Each bar list pill shows `plan_name` and item count
   - Pills use the same styling (horizontal scroll, rounded-full, active state)
   - Optionally show `project_name` as a subtle sub-label on each pill if it differs from plan_name

3. Update `filteredItems` and `filteredGroups` to filter by `cut_plan_id` instead of `project_name`

4. Auto-select the first bar list if only one exists (no "ALL" needed for single scope)

### Technical Details

```text
// New state
const [selectedBarListId, setSelectedBarListId] = useState<string | null>(null);

// Compute distinct bar lists from items
const barLists = useMemo(() => {
  const map = new Map<string, { id: string; name: string; projectName: string | null; count: number }>();
  for (const item of items) {
    const existing = map.get(item.cut_plan_id);
    if (existing) {
      existing.count++;
    } else {
      map.set(item.cut_plan_id, {
        id: item.cut_plan_id,
        name: item.plan_name,
        projectName: item.project_name,
        count: 1,
      });
    }
  }
  return [...map.values()];
}, [items]);

// Filter by selected bar list
const filteredItems = selectedBarListId
  ? items.filter((i) => i.cut_plan_id === selectedBarListId)
  : items;

const filteredGroups = selectedBarListId
  ? groups.map(g => ({
      ...g,
      bendItems: g.bendItems.filter(i => i.cut_plan_id === selectedBarListId),
      straightItems: g.straightItems.filter(i => i.cut_plan_id === selectedBarListId),
    })).filter(g => g.bendItems.length > 0 || g.straightItems.length > 0)
  : groups;
```

### What is NOT touched
- useStationData hook (data fetching remains the same)
- BarSizeGroup, ProductionCard components
- StationHeader component
- Any database tables, RLS policies, or edge functions
- Bender/Cutter station detail views
- Any other pages or components
