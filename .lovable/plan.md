

# Fix Vizzy Brain User Tab Bar — Remove Scroll, Add Unique Colors

## Problem
The user avatar bar at the top of the Vizzy Brain panel uses `overflow-x-auto` with `shrink-0` on each button, causing horizontal scrolling. All avatars use the same `bg-primary` color scheme.

## Changes

### `src/components/vizzy/VizzyBrainPanel.tsx` (lines 1019–1053)

**1. Remove horizontal scroll, allow wrapping:**
- Line 1019: Change `flex items-center gap-4 overflow-x-auto` → `flex items-center gap-3 flex-wrap`
- Remove `shrink-0` from all buttons inside

**2. Add unique colors per user:**
Define a color palette array (similar to `AssigneeManager.tsx` pattern):
```typescript
const AVATAR_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-orange-500", "bg-purple-500",
  "bg-pink-500", "bg-teal-500", "bg-red-500", "bg-amber-500",
  "bg-cyan-500", "bg-indigo-500",
];
function getNameColor(name: string) {
  let hash = 0;
  for (const c of name) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
```

**3. Apply per-user color to avatar circle** (line 1045–1048):
- When not selected: use `getNameColor(p.full_name) + " text-white"` for the avatar circle
- When selected: use the same color with a ring highlight
- The button background stays as-is for selected state (`bg-primary`) but uses a subtler style for unselected

**4. Compact sizing slightly** to fit all users without scroll:
- Avatar circle: `w-8 h-8` (from `w-10 h-10`)
- Button padding: `px-3 py-2` (from `px-4 py-2.5`)
- Font: `text-sm` for names (from `text-base`)
- Gap between items: `gap-2` (from `gap-4`)

| File | Change |
|------|--------|
| `src/components/vizzy/VizzyBrainPanel.tsx` | Remove scroll, add flex-wrap, unique avatar colors, compact sizing |

