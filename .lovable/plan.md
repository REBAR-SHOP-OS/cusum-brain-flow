

# Replace PDF Download with Comprehensive Items Report Dialog

## Problem
The download icon (red arrow in screenshot) in the "Items" section header currently generates a PDF via an edge function + html2canvas + jsPDF. The user wants it to instead **open a dialog** showing a comprehensive, English-language report of all Items sections with a summary.

## Plan

### File: `src/components/vizzy/VizzyBrainPanel.tsx`

**1. Replace `GeneralReportPDFButton` with `ItemsFullReportButton`**

Remove the entire `GeneralReportPDFButton` component (lines 413-508) and replace it with a new component that:
- Uses a `Dialog` with `DialogPortal` + z-[100002] (same pattern as `SectionDetailReportDialog` and `AgentReportDialog`)
- Icon changes from `Download` to `FileBarChart` or `ClipboardList`
- On click, opens a full-screen dialog with all Items data

**2. New dialog content — `ItemsFullReport`**

The dialog will display:

**Executive Summary section** (top):
- Grid of 4 cards: Total Items, Total Categories, Date, User/Team label
- A brief text summary: "This report covers X categories with Y total items recorded on [date]"

**Per-category breakdown** (main body):
- For each `sectionsToShow` group (Dashboard, Inbox, Team Hub, Business Tasks, etc.):
  - Category header with icon + item count
  - List of all memory items in that category with timestamps
  - If "All" view: per-user contribution counts within each category

**Team Summary** (if "All" view, no specific user selected):
- Same team stats banner already computed (`teamStats`)
- Per-user performance badges

**Copy Report button** in header — generates plain text version

**3. Wire it up**

Replace `<GeneralReportPDFButton ... />` at line 1614 with:
```tsx
<ItemsFullReportButton 
  date={userSelectedDate}
  userName={selectedProfile?.full_name || "All Users"}
  sections={sectionsToShow}
  teamStats={teamStats}
  timezone={timezone}
/>
```

The new component receives the already-computed `sectionsToShow` (the grouped/filtered memory items) and `teamStats`, so no new data fetching is needed.

### Result
- Click opens a high-z-index dialog (not PDF download)
- Shows executive summary + all category breakdowns
- Copy-to-clipboard for text version
- No black screen (z-[100002] above panel's z-[100000])

