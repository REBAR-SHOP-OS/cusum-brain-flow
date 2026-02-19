
# Fix: Priority Tags Too Bold on /office Tasks Page

## Scope
Single file: `src/pages/Tasks.tsx`
One line only (line 884). No other files, no database, no other components touched.

## Root Cause

The `Badge` component (`src/components/ui/badge.tsx`) has `font-semibold` hardcoded in its base `cva` class string:

```
"inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ..."
```

Every `<Badge>` in the app inherits this weight. The priority tag on line 884 of `Tasks.tsx` renders as:

```tsx
<Badge variant="secondary" className={cn("text-xs", PRIORITY_COLORS[selectedTask.priority || "medium"])}>
  High   ← appears as "High" in bold/semibold
</Badge>
```

Since `font-semibold` is in the base class, it wins unless explicitly overridden on this individual badge.

The user sees "Urgent" / "High Priority" tags rendered heavier than intended. Note: the priority values stored are `high`, `medium`, `low` — the badge shows `"High"`, `"Medium"`, `"Low"` (capitalized). The user's screenshot likely shows these.

## The Fix

Add `font-normal` to the `className` of the priority badge on line 884. Tailwind's specificity means the last matching utility wins, and `font-normal` will override `font-semibold` from the base Badge class:

```diff
- <Badge variant="secondary" className={cn("text-xs", PRIORITY_COLORS[selectedTask.priority || "medium"])}>
+ <Badge variant="secondary" className={cn("text-xs font-normal", PRIORITY_COLORS[selectedTask.priority || "medium"])}>
```

## Summary

| File | Line | Change |
|------|------|--------|
| `src/pages/Tasks.tsx` | 884 | Add `font-normal` to priority Badge className |

## No Other Changes
- The Badge component itself (`badge.tsx`) is NOT touched — changing it would affect badges throughout the entire app
- No other files, no database, no UI layout or logic altered
- This is a one-token addition to a single className string
