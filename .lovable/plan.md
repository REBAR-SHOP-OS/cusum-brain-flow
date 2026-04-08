

# Add Menu Items (Items) Edit Capability for Super Admins

## Goal
Allow Sattar and Radin to add/remove menu items (Items section) for users, same pattern as Agents and Automations editing.

## Changes

### 1. Database Migration
Add a `menus` column (text array) to the existing `user_access_overrides` table:
```sql
ALTER TABLE public.user_access_overrides ADD COLUMN menus text[] DEFAULT '{}';
```

### 2. `src/hooks/useUserAccessOverrides.ts`
- Add `menus: string[]` to the `UserAccessOverride` interface
- Parse `menus` field in the query result
- Add `saveMenus` mutation (same upsert pattern as `saveAgents`/`saveAutomations`)
- Return `saveMenus` from the hook

### 3. `src/components/vizzy/VizzyBrainPanel.tsx`
- Add `editingItems` state (alongside `editingAgents`, `editingAutomations`)
- Create `allMenuItems` list from `ALL_MENUS` constant
- Add pencil edit icon to the **Items** section header (line ~1129), visible only when `canEditAccess` is true
- Render `AccessEditorPopover` below the Items header when `editingItems` is true
- Use `accessOverride?.menus` (when present) instead of `getVisibleMenus()` for:
  - The menu badges display (line ~1137)
  - The `accessibleGroups` filter (line ~1108)
- Remove `overflow-hidden` from the Items section wrapper if present

| File | Action |
|------|--------|
| Migration SQL | Add `menus` column to `user_access_overrides` |
| `src/hooks/useUserAccessOverrides.ts` | Add `menus` field + `saveMenus` mutation |
| `src/components/vizzy/VizzyBrainPanel.tsx` | Add edit UI + override logic for Items section |

