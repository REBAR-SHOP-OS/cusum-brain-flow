

# Group Pages by Platform in Selection Sub-Panel

## Problem
The Pages selection panel shows a flat list of all pages. User wants them grouped by platform (Instagram header → its pages, Facebook header → its pages, LinkedIn header → its pages).

## Approach

### 1. Add `groups` support to `SelectionSubPanel`

Add an optional `groups` prop of type `{ label: string; options: SelectionOption[] }[]`. When provided, render grouped sections with platform headers instead of a flat list.

### 2. Build grouped page options in `PostReviewPanel`

Replace `filteredPageOptions` (flat array) with `groupedPageOptions` that structures pages per platform:

```text
[
  { label: "Instagram", options: [Ontario Steel Detailing, Rebar.shop, ...] },
  { label: "Facebook", options: [Ontario Steel Detailing, Rebar.shop, ...] },
  { label: "LinkedIn", options: [Ontario Steel Detailing, Ontario Logistics] },
]
```

Only include platforms that are in `localPlatforms`. Deduplicate pages within each group.

### 3. UI rendering

Each group gets a bold platform name header, followed by its page checkboxes indented below. Visual separator between groups.

## Files Changed
- `src/components/social/SelectionSubPanel.tsx` — add `groups` prop and grouped rendering
- `src/components/social/PostReviewPanel.tsx` — build grouped options from `PLATFORM_PAGES` keyed by `localPlatforms`

