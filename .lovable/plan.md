

# Show User Access Permissions in Agents & Items Sections

## Summary
Display which agents and menu items each user has access to in the Vizzy Brain panel, based on the centralized access config (`userAccessConfig.ts`).

## Changes

### 1. Agents Section — Show accessible agents list (`src/components/vizzy/VizzyBrainPanel.tsx`)

In the `UserAgentsSections` component, ensure all agents from `getVisibleAgents(email)` are always displayed, even if session data is still loading or empty. Currently the component already does this, but the issue may be that `email` is not being passed. Verify the `email` prop is always provided from `selectedProfile.email`.

Additionally, for `fullAccess` users (Sattar, Radin), all agents should appear since `getVisibleAgents` returns `ALL_AGENTS`.

### 2. Items Section — Add menu access list (`src/components/vizzy/VizzyBrainPanel.tsx`)

Below the existing "Items" header (around line 987), add a compact row showing which **menu items** (pages) the selected user can access, pulled from `getVisibleMenus(selectedProfile.email)`.

Display as a horizontal wrap of small badges:

```tsx
// Inside the Items section, before the grouped entries
const userMenuItems = getVisibleMenus(selectedProfile?.email);

// Render as compact badges
<div className="flex flex-wrap gap-1.5 mb-3">
  {userMenuItems.map(menu => (
    <span key={menu} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
      {menu}
    </span>
  ))}
</div>
```

### 3. Fix email prop passing

Ensure `selectedProfile.email` is always passed to `UserAgentsSections` at line 1188. If it's `undefined` for some profiles, the `getVisibleAgents` call returns `[]`, causing "No agents assigned".

| File | Change |
|------|--------|
| `src/components/vizzy/VizzyBrainPanel.tsx` | Add menu items badges in Items section; verify email prop in Agents section |

