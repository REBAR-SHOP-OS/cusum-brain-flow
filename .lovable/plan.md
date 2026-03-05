

# Fix: Workspace Dropdown Should Always Show Active Projects

## Problem
The "TIES" chip in the header is a static badge when there's only one project. The user expects it to always be a clickable dropdown showing active projects.

## Root Cause
Two guards prevent the dropdown from appearing with a single project:
- `StationView.tsx` line 265: `projects={projects.length > 1 ? projects : undefined}` — only passes projects when >1
- `StationHeader.tsx` line 66: `hasMultipleProjects = projects && projects.length > 1` — requires >1 for dropdown

## Fix

### 1. `src/pages/StationView.tsx` (line 265)
Change: `projects={projects.length > 1 ? projects : undefined}` → `projects={projects.length > 0 ? projects : undefined}`

### 2. `src/components/shopfloor/StationHeader.tsx` (line 66)
Change: `const hasMultipleProjects = projects && projects.length > 1 && onSelectProject;` → `const hasProjects = projects && projects.length > 0 && onSelectProject;`

Update the JSX condition on line 160 from `hasMultipleProjects` to `hasProjects`.

Two-line change across two files.

