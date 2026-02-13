

# Fix Search (Odoo-Style) and Add Full Contact Info to Prospects

## Two Changes

### 1. Pipeline Search -- Clone Odoo Style

Currently the search bar and filters are on separate rows with the search inline among action buttons. The Odoo style (image reference) puts the search bar as a wide, prominent input on its own with a dropdown arrow that opens the filter/group-by/favorites panel.

**Changes to `src/pages/Pipeline.tsx`:**
- Move the search input to be full-width on its own row (below title row), styled like Odoo's search bar
- Add a dropdown arrow button on the right side of the search bar that toggles the filter popover
- Remove the separate "Filters" button row -- merge it into the search bar dropdown

**Changes to `src/components/pipeline/PipelineFilters.tsx`:**
- Restructure so the filter panel can be triggered externally (via a `isOpen`/`onOpenChange` prop from the parent search bar dropdown arrow)
- Keep the 3-column layout (Filters | Group By | Favorites) as-is -- it already matches the Odoo screenshot

**New layout:**
```
Row 1: Pipeline title + stats | [action buttons: Scan RFQ, Odoo Sync, Prospect, Blitz, Add Lead]
Row 2: [ Search leads, customers, source...                              | v ]  <-- full-width search with dropdown arrow
        (clicking arrow opens filter panel below, same 3-column layout)
```

### 2. Prospect Table -- Show All Contact Info (Phone Column)

The prospect table currently hides the phone number. The AI already collects phone numbers but they're not displayed.

**Changes to `src/components/prospecting/ProspectTable.tsx`:**
- Add a "Phone" column after the Email column
- Display `p.phone` in the new column

**Changes to `supabase/functions/prospect-leads/index.ts`:**
- Make `phone` a required field in the AI tool schema (move from optional to `required` array)
- Ensure the prompt emphasizes generating realistic Ontario phone numbers (area codes 416, 647, 905, 613, etc.)

---

## Technical Details

### Pipeline.tsx header restructure
- Row 1 keeps title/stats on left, action buttons on right (same as now but without the search input)
- Row 2 is a new full-width search bar with:
  - Search icon on left
  - Input spanning full width
  - ChevronDown button on right that toggles `PipelineFilters` popover
  - Active filter chips appear below the search bar when filters are active

### PipelineFilters.tsx refactor
- Accept `open` and `onOpenChange` props instead of managing its own Popover state internally
- The parent controls when the panel shows (triggered by the dropdown arrow on the search bar)
- The 3-column content stays identical

### ProspectTable.tsx phone column
- Add `Phone` TableHead after Email
- Add `p.phone` TableCell, hidden on smaller screens (`hidden md:table-cell`)

### prospect-leads edge function
- Add `"phone"` to the `required` array in the tool schema
- Update prompt to specify Ontario area codes for realistic phone generation
