

# Revert User Tab Bar & Move Role/Title to General Overview

## Problem
The user tab buttons now show role and job title underneath each name, making them too large and visually cluttered. The user wants the tab bar reverted to its previous compact style (avatar + first name only) and the role/title info moved into the **General Overview** section.

## Changes

### 1. Revert user tab buttons (`src/components/vizzy/VizzyBrainPanel.tsx`, lines 1085–1096)

Remove the `flex-col` wrapper and role/title subtitle. Each button goes back to:
```
[Avatar] FirstName
```

Replace lines 1085–1096 with:
```tsx
<span className="text-sm font-bold">{firstName}</span>
```

### 2. Add role & title to General Overview section (lines 1113–1156)

Inside the General Overview card, after the header and before `<PerformanceCard>`, add a small info row showing:
- **Role(s)**: uppercase badges (e.g., ADMIN, SALES)
- **Job Title**: from `selectedProfile.title`

```tsx
{/* User info: role + title */}
<div className="px-4 py-2 border-b border-border/50 flex items-center gap-2 text-sm">
  <span className="font-semibold">{selectedProfile.full_name}</span>
  {selectedProfile.user_id && roleMap[selectedProfile.user_id]?.length > 0 && (
    <span className="text-[11px] uppercase font-bold text-primary">
      {roleMap[selectedProfile.user_id].join(", ")}
    </span>
  )}
  {selectedProfile.title && (
    <>
      <span className="text-muted-foreground">·</span>
      <span className="text-muted-foreground text-xs">{selectedProfile.title}</span>
    </>
  )}
</div>
```

This row appears between the section header and the PerformanceCard. The `roleMap` and `userRolesData` query remain unchanged — just the display location moves.

| File | Change |
|------|--------|
| `src/components/vizzy/VizzyBrainPanel.tsx` | Revert tab buttons to compact style; add role/title row inside General Overview |

