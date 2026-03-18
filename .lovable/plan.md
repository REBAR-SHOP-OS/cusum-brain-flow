

## Plan: Add Farsi Translation to Event Calendar in Pixel Workspace

### Problem
The Event Calendar in the Pixel agent workspace shows event details in English only when expanded. Persian translations already exist in `PERSIAN_EVENT_INFO` (in `ContentStrategyPanel.tsx`) but are not used in the `EventCalendarSection` component in `AgentWorkspace.tsx`.

### Changes

**File: `src/pages/AgentWorkspace.tsx`**

1. Import `PERSIAN_EVENT_INFO` from `ContentStrategyPanel.tsx` (need to export it first).
2. In the expanded detail panel of `EventCalendarSection` (around line 936), add a Persian section below the English description showing:
   - Persian summary title (RTL)
   - Persian details text (RTL)
   - Visual separator between English and Persian

**File: `src/components/social/ContentStrategyPanel.tsx`**

1. Export the `PERSIAN_EVENT_INFO` constant so it can be imported by `AgentWorkspace.tsx`.

### Result
When a user expands an event card, they see both the English description and the Persian translation below it, with RTL formatting.

