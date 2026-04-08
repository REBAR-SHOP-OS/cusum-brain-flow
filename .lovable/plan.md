

# Fix: General Report Filtering by Selected User's Menu Access

## Problem
Line 928 in `VizzyBrainPanel.tsx` uses `getVisibleMenus(user?.email)` — the **logged-in user's** menus — to filter General Report sections. This means:
- When an admin (e.g., Radin with fullAccess) selects another user like Zahra, Zahra's report still shows ALL sections instead of only "Business Tasks" and "Support"
- The report should reflect **the selected profile's** menu permissions, not the viewer's

## Fix

### File: `src/components/vizzy/VizzyBrainPanel.tsx`

**Change lines 927–933**: Use the selected profile's email (when a profile is selected) instead of the logged-in user's email:

```typescript
// Filter sections by the SELECTED user's menu access (or viewer's if "All")
const targetEmail = selectedProfile?.email ?? user?.email;
const userMenus = getVisibleMenus(targetEmail);
const accessibleGroups = grouped.filter((group) => {
  const requiredMenu = GROUP_TO_MENU[group.key];
  if (!requiredMenu) return true;
  return userMenus.includes(requiredMenu);
});
```

This single-line change ensures:
- **Radin views Zahra** → only "Business Tasks" + "Support" sections appear
- **Radin views Kourosh** → only "Time Clock", "Shop Floor", "Team Hub"
- **"All" view** → shows sections based on the viewer's own access
- **Each user's self-view** → matches their own menu items

### Menu config already correct
The `userAccessConfig.ts` already matches the user's requested menu items exactly — no changes needed there.

| File | Change |
|------|--------|
| `src/components/vizzy/VizzyBrainPanel.tsx` | Use selected profile's email for menu filtering |

