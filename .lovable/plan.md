

# Add "General Report" Header to All-Tab Category Accordions

## Goal
Wrap all the category accordion items (Dashboard, Inbox, Team Hub, Business Tasks, etc.) shown in the "All" tab with a parent section titled "General Report" — consistent with the naming used in other sections.

## Change

### `src/components/vizzy/VizzyBrainPanel.tsx` (lines 855-871, inside `renderContent`)
Wrap the existing `<Accordion>` block with a styled container that includes a "General Report" header, matching the card style used in the per-user sections (rounded-xl border, header bar with icon + title + report button).

**Before:**
```tsx
return (
  <Accordion type="multiple" className="w-full space-y-1">
    {sectionsToShow.map((group) => (...))}
  </Accordion>
);
```

**After:**
```tsx
return (
  <div className="rounded-xl border border-border bg-card overflow-hidden">
    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/40">
      <FileBarChart className="w-4 h-4 text-primary" />
      <h3 className="text-sm font-semibold text-foreground flex-1">General Report</h3>
      <SectionReportButton label="General Report" getText={...} />
    </div>
    <div className="p-3">
      <Accordion type="multiple" className="w-full space-y-1">
        {sectionsToShow.map((group) => (...))}
      </Accordion>
    </div>
  </div>
);
```

The `SectionReportButton` will generate a summary of all categories with their counts.

## Impact
- Single file change
- Visual-only — no logic changes

