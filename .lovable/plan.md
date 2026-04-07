

# Replace Clipboard Icons with Comprehensive User Report Button

## Goal
Replace the clipboard/copy icons in the "Agents" section header (and optionally other sections) with a button that generates a comprehensive summary report of the user's overall performance — covering all agents, activities, time clock, and system usage — instead of just copying text.

## Current State
- `SectionReportButton` is a simple clipboard-copy button used in every section header (Overview, Agents, Activity Log, Time Clock)
- The user specifically circled the one in the **Agents** section and wants it to produce a full user performance report rather than copy text

## Plan

### 1. Create `UserFullReportButton` component (in `VizzyBrainPanel.tsx`)
- New button component that replaces the `SectionReportButton` in the **Agents** section header
- Uses a report/file icon (e.g. `FileText` from lucide) instead of `ClipboardList`
- On click, aggregates data from all available hooks and generates a comprehensive text report:
  - **Performance**: clock-in time, hours worked, activities count, AI sessions, emails sent
  - **Agents**: list of all agents used, session counts, message totals, last active date
  - **Activity Log**: summary of today's activities
  - **Time Clock**: all clock entries for the day
- Copies the full report to clipboard with a success toast

### 2. Data aggregation approach
- The button will be rendered inside the `selectedProfile` block where all hooks are already available
- It will receive pre-fetched data as props from `useUserPerformance`, `useUserAgentSessions`, `useUserActivityLog`, and time clock data
- Format as a clean text report with sections and bullet points

### 3. Wire it up
- Replace `SectionReportButton` in the Agents section with the new `UserFullReportButton`
- Pass the selected profile info + hook data as props

## File Changes

| File | Change |
|------|--------|
| `src/components/vizzy/VizzyBrainPanel.tsx` | Add `UserFullReportButton` component; replace `SectionReportButton` in Agents header; pass aggregated data |

## Technical Notes
- Single file change — all hooks are already imported and used in the panel
- The report text will be formatted as a readable summary suitable for sharing (e.g. via chat or email)
- Icon changes from `ClipboardList` to `FileText` to signal "report" rather than "copy"

