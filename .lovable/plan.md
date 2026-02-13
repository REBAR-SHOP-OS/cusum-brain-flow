

# Merge Pipeline and Prospecting Filter Components

## Problem
`PipelineFilters.tsx` and `ProspectingFilters.tsx` are nearly identical components with duplicated sub-components (`FilterToggle`, `FilterChip`, `FieldFilter`, `DateFilterDropdown`). They should be merged into a single configurable component.

## Approach

### 1. Create shared filter building blocks: `src/components/ui/filter-popover.tsx`

Extract the shared sub-components into a reusable module:
- `FilterToggle` -- toggle button with check icon
- `FilterChip` -- removable badge chip
- `FieldFilter` -- dropdown field picker
- `DateFilterDropdown` -- date range picker

These are currently duplicated across both files with identical code.

### 2. Refactor `src/components/pipeline/PipelineFilters.tsx`

- Remove the inline `FilterToggle`, `FilterChip`, `FieldFilter`, `DateFilterDropdown` definitions
- Import them from the new shared module
- Keep the Pipeline-specific filter state, types, and layout unchanged

### 3. Refactor `src/components/prospecting/ProspectingFilters.tsx`

- Remove the inline `FilterToggle`, `FilterChip`, `FieldFilter` definitions
- Import them from the new shared module
- Keep the Prospecting-specific filter state, types, and layout unchanged

### Result
- Zero visual changes -- both pages look and work exactly the same
- Shared sub-components live in one place, eliminating ~130 lines of duplicated code
- Future filter UIs can reuse the same building blocks

### Technical Notes
- No prop changes to either parent component -- `Pipeline.tsx` and `Prospecting.tsx` remain untouched
- The shared module exports pure presentational components only (no state management)
- Both filter components keep their own `localStorage` keys for saved filters

