

# Fix User Tab Wrapping & Update Zahra's Job Title

## Problem
1. User avatars wrap to a second line (Vicky appears on line 2) — all should be on one line
2. Zahra's job title is empty — should be "Digital Marketing"

## Changes

### 1. Make user tabs single-line (`src/components/vizzy/VizzyBrainPanel.tsx`, line 1055)

Remove `flex-wrap` and add `overflow-x-auto` with `shrink-0` on buttons so all users stay on one horizontal line with subtle scroll if needed:

```tsx
// Before:
<div className="px-5 py-3 border-b border-border flex items-center gap-2 flex-wrap">

// After:
<div className="px-5 py-3 border-b border-border flex items-center gap-2 overflow-x-auto scrollbar-none">
```

Also add `shrink-0` to each user button (line 1075) to prevent them from shrinking.

### 2. Update Zahra's job title in database

Run a migration to set `title = 'Digital Marketing'` for `zahra@rebar.shop`:

```sql
UPDATE profiles SET title = 'Digital Marketing' WHERE email = 'zahra@rebar.shop';
```

| File / System | Change |
|------|--------|
| `src/components/vizzy/VizzyBrainPanel.tsx` | Remove `flex-wrap`, add horizontal scroll with hidden scrollbar + `shrink-0` on buttons |
| Database migration | Set Zahra's title to "Digital Marketing" |

