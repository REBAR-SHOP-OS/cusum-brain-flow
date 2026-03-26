

# Move Home Icon Down in Ad Director Sidebar

## Problem
The Home icon in the Ad Director sidebar is too close to the top, making it hard for users to see — it sits right under the collapse toggle with minimal spacing.

## Change

### `src/components/ad-director/AdDirectorSidebar.tsx`
Change the nav's top padding from `pt-1` to `pt-3` (line 56) to give more breathing room above the Home item.

```
Before: <nav className="flex-1 overflow-y-auto px-1.5 space-y-0.5 pt-1">
After:  <nav className="flex-1 overflow-y-auto px-1.5 space-y-0.5 pt-3">
```

| File | Change |
|---|---|
| `AdDirectorSidebar.tsx` | Increase nav top padding from `pt-1` to `pt-3` |

