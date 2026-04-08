

# Fix: General Report Sections Must Match User Menu Items

## Problem
Two issues:

1. **Empty sections are hidden** — Line 937 in `VizzyBrainPanel.tsx` filters out groups with no data (`group.items.length > 0`). When Radin (full access) is selected, only "Business Tasks" and "Time Clock" show because other sections have no entries today. The user wants ALL accessible sections to always appear.

2. **Neel's config is too broad** — Uses `ALL_MENUS minus CEO Portal`, which includes "Admin Panel" and "Kiosk" not in the user's specified list.

## Changes

### 1. `src/components/vizzy/VizzyBrainPanel.tsx`
**Remove the empty-section filter** (line 936–938):
```typescript
// Before:
const sectionsToShow = selectedProfile
  ? accessibleGroups.filter((group) => group.items.length > 0)
  : accessibleGroups;

// After:
const sectionsToShow = accessibleGroups;
```
This ensures all menu-accessible sections appear for every user, showing "(0)" when no data exists.

### 2. `src/lib/userAccessConfig.ts`
**Replace neel's dynamic filter with an explicit list** (line 95):
```typescript
menus: [
  "Dashboard", "Inbox", "Team Hub", "Business Tasks", "Live Monitor",
  "Support", "Pipeline", "Lead Scoring", "Customers", "Accounting",
  "Sales", "Shop Floor", "Time Clock", "Office Tools",
  "Inventory", "Diagnostics", "Architecture", "Settings",
],
```
This removes "Admin Panel" and "Kiosk" that were being included by the previous `ALL_MENUS.filter()` logic.

## Result
- Each user's General Report shows exactly the sections matching their menu items
- Empty sections still appear (with 0 count) so structure is always consistent
- Neel's access matches the specified 18-item list exactly

| File | Change |
|------|--------|
| `src/components/vizzy/VizzyBrainPanel.tsx` | Remove empty-section filter |
| `src/lib/userAccessConfig.ts` | Explicit menu list for neel |

