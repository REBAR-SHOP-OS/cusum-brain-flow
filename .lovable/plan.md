

# Fix Recents Date Display for Pixel Agent

## Problem
In the sidebar, the session title (already stored as `yyyy-MM-dd`) is unnecessarily parsed through `new Date()` and reformatted. This causes a timezone shift -- `new Date("2026-02-14")` creates midnight UTC, which becomes Feb 13 in timezones west of UTC (like US timezones).

## Solution
Display `session.title` directly instead of parsing it through `new Date()`.

## Technical Change

### `src/components/agent/AgentHistorySidebar.tsx` (line 131)

**Before:**
```tsx
format(new Date(session.title), "yyyy-MM-dd")
```

**After:**
```tsx
session.title
```

This is a one-line fix. The title is already stored as `yyyy-MM-dd` in the database, so no parsing or formatting is needed.
