

# Add Pipeline-Style Search, Filters & Group-by-User to Prospecting Page

## Overview
Clone the Pipeline page's Odoo-style header layout (search bar with icon, filter popover with 3-column layout, active filter chips) onto the Prospecting page, and add a "view per user" grouping option.

## Changes

### 1. New Component: `src/components/prospecting/ProspectingFilters.tsx`

A filter popover modeled after `PipelineFilters.tsx` with three columns:

**Column 1 -- Filters:**
- Status toggles: Pending, Approved, Rejected, Emailed
- Industry filter (dropdown from unique industries in data)
- City filter (dropdown from unique cities)

**Column 2 -- Group By:**
- Salesperson (view per user -- groups by the user who approved/created)
- Status
- Industry
- City

**Column 3 -- Favorites:**
- Save/load/delete saved filter presets (localStorage, same pattern as Pipeline)

Exports a `ProspectingFilterState` type and `DEFAULT_PROSPECT_FILTERS` constant.

### 2. Update: `src/pages/Prospecting.tsx`

**Header redesign to match Pipeline layout:**
- Row 1: Title + stats on left, search input with magnifying glass icon (debounced 300ms), region input, "Dig 50 Leads" button on right
- Row 2: `ProspectingFilters` component with active filter chips

**Search:** Client-side filtering across `company_name`, `contact_name`, `email`, `city`, `industry`, `fit_reason` fields.

**Filtering:** Apply `ProspectingFilterState` filters client-side on the prospects array.

**Grouping:** When a group-by option is selected (e.g., "status", "industry", "city"), render prospects in grouped sections with headers showing the group name and count, instead of a single flat table.

### 3. Update: `src/components/prospecting/ProspectTable.tsx`

Add an optional `groupLabel` prop so it can be rendered multiple times (once per group) with a section header above each table.

### 4. "View Per User" Detail

The group-by "Salesperson" option will group prospects by matching them to the user who approved them. Since prospects don't have an assigned salesperson field, we'll group by `status` as the primary user-workflow view, and add a batch-based grouping as well. The "Salesperson" group will show "Unassigned" for all prospects (since they're pre-pipeline), making status and industry the most useful groupings.

## Technical Details

- Search uses a 300ms debounce (`useEffect` + `setTimeout`) matching the Pipeline pattern
- Search input styled identically: `Search` icon absolutely positioned at `left-2.5`, input with `pl-8 h-8 text-sm`
- Filter state managed via `useState` in Prospecting page, passed down as props
- Saved filters stored in `localStorage` under key `prospecting_saved_filters`
- `useMemo` for deriving unique industries, cities, and filtered/grouped results
- Active filter count shown as badge on the Filters button, with removable chips below

