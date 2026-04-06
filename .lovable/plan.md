

# Hide Empty Brain Sections When User Is Selected

## Problem
When a specific user is selected in the avatar bar, all 16 Brain sections still appear — most showing "(0)". This is a monitoring view: it should only display sections where the selected user has actual activity. Empty sections add clutter.

## Rule
When a user is selected, **only show Brain sections that have at least 1 memory entry** for that user. If "All" is selected, show all sections as before.

## Changes

### File: `src/components/vizzy/VizzyBrainPanel.tsx`

In the `renderContent()` function (around line 415-438), filter out empty groups when a user profile is selected:

- Before rendering the accordion, filter `grouped` to exclude groups with `items.length === 0` **only when** `selectedProfile` is set
- When no profile is selected ("All" mode), keep current behavior showing all sections
- Add an empty state message if a user is selected but has zero entries across all sections

Approximately 3-5 lines changed in the render logic.

## Files Changed
- `src/components/vizzy/VizzyBrainPanel.tsx` — filter empty sections when user is selected

