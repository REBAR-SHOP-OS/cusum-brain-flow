
# Fix: Multi-Project Mixing on Station View

## Root Cause

The station view combines items from multiple active cut plans/projects into a single unfiltered list. The `project_name` field is already fetched from the database and exists on every `StationItem`, but it is never displayed or used to filter.

**Bender path**: queries ALL `cut_plan_items` company-wide with `phase = cut_done OR bending`. Every project's bend items appear together with no separation.

**Cutter path**: queries all plans assigned to the machine OR unassigned (`machine_id.is.null`), which can include multiple active projects simultaneously. Items are grouped by bar size only — the `BarSizeGroup` header shows `10M` / `15M` but never says which project.

---

## What Is NOT Broken

- `project_name` is already correctly fetched — it's present on every `StationItem`
- The grouping logic (bar size → bend/straight paths) is correct
- Realtime subscriptions work correctly

---

## Proposed Fix: Two-Part Solution

### Part 1 — Project Filter Pill Row (StationView.tsx)

Add a horizontal scrollable row of project filter pills below the station header, visible when more than one project is present in the loaded items. Selecting a pill filters all items and groups to that project only. An "All" pill is always available as the default.

```
[ All (47) ]  [ TANK FARM — OAA (12) ]  [ Vault 1 (8) ]  [ 15 Brownridge (27) ]
```

- Pills are derived from the distinct `project_name` values in the loaded `items` array (no extra DB query needed)
- Selected project is stored in `useState<string | null>(null)` (null = All)
- Filtering is applied in `StationView.tsx` before passing items/groups to the rendered list

### Part 2 — Project Name Label on ProductionCard.tsx

Add a small project name micro-label at the bottom of each card (consistent with the shop floor touch standard for micro-labels):

```
TANK FARM RETAINING WALLS — OAA
```

This ensures that even in "All" mode, each card always self-identifies which project it belongs to. This is critical for the bender view where no grouping by bar size exists.

---

## Technical Changes

### File 1: `src/pages/StationView.tsx`

Add `selectedProject` state and a filter pill row:

```tsx
const [selectedProject, setSelectedProject] = useState<string | null>(null);

// Derive distinct project names from loaded items
const projectNames = useMemo(() =>
  [...new Set(items.map((i) => i.project_name).filter(Boolean))] as string[],
  [items]
);

// Apply project filter before rendering
const filteredItems = selectedProject
  ? items.filter((i) => i.project_name === selectedProject)
  : items;

const filteredGroups = selectedProject
  ? groups.map((g) => ({
      ...g,
      bendItems: g.bendItems.filter((i) => i.project_name === selectedProject),
      straightItems: g.straightItems.filter((i) => i.project_name === selectedProject),
    })).filter((g) => g.bendItems.length > 0 || g.straightItems.length > 0)
  : groups;
```

Project pill row (only shown when `projectNames.length > 1`):
```tsx
{projectNames.length > 1 && (
  <div className="flex gap-2 overflow-x-auto pb-1 pt-2 scrollbar-none">
    <button onClick={() => setSelectedProject(null)}
      className={cn("pill", !selectedProject && "active")}>
      All ({items.length})
    </button>
    {projectNames.map((name) => (
      <button key={name} onClick={() => setSelectedProject(name)}
        className={cn("pill", selectedProject === name && "active")}>
        {name} ({items.filter(i => i.project_name === name).length})
      </button>
    ))}
  </div>
)}
```

Auto-reset `selectedProject` to null if the selected project disappears from the item list (e.g., after a phase transition):
```tsx
useEffect(() => {
  if (selectedProject && !projectNames.includes(selectedProject)) {
    setSelectedProject(null);
  }
}, [projectNames, selectedProject]);
```

### File 2: `src/components/shopfloor/ProductionCard.tsx`

Add a project name label at the bottom of `CardContent`, below the piece count row:
```tsx
{item.project_name && (
  <p className="text-[9px] text-muted-foreground tracking-[0.15em] uppercase truncate pt-0.5 border-t border-border/40 mt-1">
    {item.project_name}
  </p>
)}
```

---

## Summary of Files to Change

| File | Change |
|------|--------|
| `src/pages/StationView.tsx` | Add `selectedProject` state, project pill filter row, derive `filteredItems` / `filteredGroups`, auto-reset effect |
| `src/components/shopfloor/ProductionCard.tsx` | Add project name micro-label at card bottom |

No database changes, no new queries, no new hooks — `project_name` is already in `StationItem`.
